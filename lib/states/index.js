'use strict';
const maasState = require('./maas-states.json');
const MaasError = require('../errors/MaaSError');
const lib = require('../utils/index');

function isStateValid(tableName, oldState, newState) {

  const stateList = maasState[tableName];
  const stateNameList = Object.keys(stateList).map(state => state);

  // Handle old state invalid case
  if (stateNameList.indexOf(oldState) === -1) {
    return false;
  }

  // Handle case self state reannotation
  if (oldState === newState) {
    return true;
  }

  // Handle new state not in the list
  const availableNewState = stateList[oldState].transition;
  if (availableNewState.indexOf(newState) === -1) {
    return false;
  }

  return true;
}

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
 * Change state of the item and log it
 * RETURN: newState
 */
function changeState(tableName, knex, itemId, oldState, newState, item) {

  if (maasState[tableName] === undefined) {
    return Promise.reject(new MaasError('Invalid tableName input', 400));
  }

  if (!isStateValid(tableName, oldState, newState)) {
    return Promise.reject(new MaasError('Invalid state(s) input', 400));
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
  changeState,
};
