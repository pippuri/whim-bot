'use strict';
const maasState = require('./maas-states.json');
const MaasError = require('../errors/MaaSError');
const lib = require('../utils/index');

/**
 * Check if oldState can transition into the newState
 */
function isStateValid(tableName, oldState, newState) {

  const stateList = maasState[tableName];
  const stateNameList = Object.keys(stateList).map(state => state);

  // Handle old state invalid case
  if (stateNameList.indexOf(oldState) === -1) {
    return false;
  }

  // Handle new state not in the list
  const availableNewState = stateList[oldState].transition;
  if (availableNewState.indexOf(newState) === -1) {
    return false;
  }

  return true;
}

/**
 * Save the state transition into the log
 */
function logState(tableName, knex, itemId, oldState, newState) {
  return knex
    .insert({
      id: lib.createId(),
      tableName: tableName,
      itemId: itemId,
      oldState: oldState,
      newState: newState,
      created: new Date(Date.now()).toISOString(),
    })
    .into('StateLog')
    .returning(['newState', 'tableName', 'itemId']);
}

/**
 * Get the current state of the item with its id in the table
 */
function getState(tableName, knex, itemId) {
  return knex.select('state')
    .from(tableName)
    .where('id', itemId)
    .then(response => {
      if (response.length !== 1) {
        return Promise.reject(new Error(`500: Error getting current state of item ${itemId} from ${tableName}`));
      }
      return response[0].state;
    });
}

/**
 * Change state of the item and log it
 * RETURN: newState
 */
function changeState(tableName, knex, itemId, oldState, newState) {

  if (maasState[tableName] === undefined) {
    return Promise.reject(new MaasError('Invalid tableName input', 400));
  }

  if (!isStateValid(tableName, oldState, newState)) {
    return Promise.reject(new MaasError(`Invalid state(s) input. oldState: ${oldState}, newState ${newState}`, 400));
  }

  return logState(tableName, knex, itemId, oldState, newState)
    .then(response => {
      return knex.update({ state: newState }, ['state'])
        .into(tableName)
        .where({ id: itemId });
    })
    .then(response => {
      return Promise.resolve(newState);
    });
}

module.exports = {
  isStateValid,
  getState,
  changeState,
};
