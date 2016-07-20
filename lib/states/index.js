'use strict';
const maasState = require('./maas-states.json');
const MaasError = require('../errors/MaaSError');
const lib = require('../utils/index');
const Booking = require('../models/index').Booking;
const Leg = require('../models/index').Leg;
const Itinerary = require('../models/index').Itinerary;
const Promise = require('bluebird');

class StateMachine {
  static init() {

  }

  /**
   * Check if oldState can transition into the newState
   * @param {String} tableName
   * @param {String} oldState
   * @param {String} newState
   * @return {Boolean} isStateValid
   */
  static isStateValid(tableName, oldState, newState) {

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
   * @param {String} tableName
   * @param {UUID} itemId
   * @param {String} oldState
   * @param {String} newState
   * @return {empty Promise}
   */
  static logState(tableName, itemId, oldState, newState) {
    const payload = {
      id: lib.createId(),
      tableName: tableName,
      itemId: itemId,
      oldState: oldState,
      newState: newState,
      created: new Date().toISOString(),
    };

    console.info('STATE CHANGE', JSON.stringify(payload, null, 2));
    return Promise.resolve();
  }

  /**
   * Change state of the item and log it
   * @param {String} tableName
   * @param {UUID} itemId
   * @param {String} oldState
   * @param {String} newState
   * @return {String} newState
   */
  static changeState(tableName, itemId, oldState, newState) {

    if (typeof maasState[tableName] === 'undefined') {
      return Promise.reject(new MaasError('Invalid tableName input', 400));
    }

    if (!StateMachine.isStateValid(tableName, oldState, newState)) {
      return Promise.reject(new MaasError(`Invalid state(s) input. oldState: ${oldState}, newState ${newState}`, 400));
    }

    return StateMachine.logState(tableName, itemId, oldState, newState)
      .then(() => newState);
  }

  /**
   * Return state of an item from availableTables
   * @param  {String} tableName
   * @param  {UUID} itemId
   * @return {String} state
   */
  static getState(tableName, itemId) {
    const availableTables = {
      Leg: Leg,
      Itinerary: Itinerary,
      Booking: Booking,
    };

    if (Object.keys(availableTables).indexOf(tableName) === -1) {
      return Promise.reject(new MaasError('Unavailable tableName', 500));
    }

    return availableTables[tableName]
      .query()
      .select('state')
      .then(response => {
        if (response.length !== 1) {
          return Promise.reject(new MaasError('Response contains more than 1 results', 500));
        }
        return response[0];
      });
  }
}

module.exports = {
  StateMachine,
};
