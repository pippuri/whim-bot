'use strict';
const maasState = require('./maas-states.json');
const MaasError = require('../errors/MaaSError');
const lib = require('../utils/index');

function validNewState(tableName, oldState, newState) {

  const stateList = maasState[tableName];
  const stateNameList = Object.keys(stateList).map(state => state.toUpperCase());

  if (stateNameList.indexOf(oldState.toUpperCase()) === -1) {
    return false;
  }

  const availableNewState = stateList[oldState.toUpperCase()].nested;

  if (availableNewState.indexOf(newState.toUpperCase()) === -1) {
    return false;
  }

  return true;
}

function logState(tableName, knex, itemId, from, to) {
  return knex
    .insert({
      id: lib.createId(),
      tableName: tableName,
      itemId: itemId,
      from: from,
      to: to,
      created: new Date(Date.now()).toISOString(),
    })
    .into(tableName)
    .returning(['newState', 'tableName', 'itemId']);
}

function changeState(tableName, knex, itemId, oldState, newState) {

  if (maasState[tableName] === undefined) {
    return Promise.reject(new MaasError('Invalid tableName input', 400));
  }

  if (!validNewState(tableName, oldState, newState)) {
    return Promise.reject(new MaasError('Invalid state(s) input', 400));
  }

  return logState(tableName, knex, itemId, oldState, newState)
    .then(response => {
      return knex.update({ state: response.newState }, ['state', 'id'])
        .into(response.tableName)
        .where({
          id: response.itemId,
        });
    });
}

module.exports = {
  validNewState,
  logState,
  changeState,
};
