'use strict';
const maasStates = require('./maas-states.json');
const MaaSError = require('../errors/MaaSError');
const lib = require('../utils/index');
const Booking = require('../models/index').Booking;
const Leg = require('../models/index').Leg;
const Itinerary = require('../models/index').Itinerary;
const Promise = require('bluebird');

const availableTables = {
  Leg: Leg,
  Itinerary: Itinerary,
  Booking: Booking,
};

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

    const stateList = maasStates[tableName];
    const stateNameList = Object.keys(stateList);

    // Handle old state invalid case
    if (stateNameList.indexOf(oldState) === -1) {
      return false;
    }

    // Handle new state not in the list
    const availableNewStates = stateList[oldState].transition;
    if (availableNewStates.indexOf(newState) === -1) {
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

    if (typeof maasStates[tableName] === 'undefined') {
      return Promise.reject(new MaaSError(`Invalid table ${tableName}`, 400));
    }

    if (!StateMachine.isStateValid(tableName, oldState, newState)) {
      const message = `Invalid state(s) input for table ${tableName} item ${itemId}. oldState: ${oldState}, newState ${newState}`;
      return Promise.reject(new MaaSError(message, 400));
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
    if (Object.keys(availableTables).indexOf(tableName) === -1) {
      return Promise.reject(new MaaSError('Unavailable tableName', 500));
    }

    return availableTables[tableName]
      .query()
      .select('state')
      .then(response => {
        if (response.length !== 1) {
          return Promise.reject(new MaaSError('Response contains more than 1 results', 500));
        }
        return response[0];
      });
  }

  /**
   * Returns the available states for a table
   *
   * @param  {String} tableName
   * @return {Array} containing state names, or null if none available
   * @throws {MaaSError} 400 if an invalid tabke name is given
   */
  static getAllStates(tableName) {
    const mapping = maasStates[tableName];

    if (typeof mapping === typeof undefined) {
      throw new MaaSError('Unavailable tableName ${tableName}', 400);
    }

    return Object.keys(mapping);
  }
}

module.exports = {
  StateMachine,
};
