'use strict';

const Promise = require('bluebird');
const utils = require('../utils');
const mock = require('./itinerary-mock.json');

/**
 * An encapsulation of Itinerary that handles the operations
 * to create, retrieve, list and cancel the itinerary.
 */
class Itinerary {

  /**
   * A factory method that constructs the itinerary from a DAO
   *
   * @param {object} itinerary a raw itinerary object (e.g. JSON object)
   */
  constructor(itinerary) {
    // Assign the data object with a frozen copy
    this.itinerary = itinerary;
  }

  /**
   * Validates a given DAO that it is a valid itinerary
   *
   * @param {object} itinerary The configuration object
   */
  static validate(itinerary) {
    return true;
  }

  static retrieve() {
    return Promise.resolve(new Itinerary(mock));
  }

  static query(params) {
    return Promise.resolve([new Itinerary(mock)]);
  }

  reserve() {
    return Promise.resolve(mock);
  }

  cancel() {
    return Promise.resolve();
  }

  toJSON() {
    return utils.cloneDeep(this.itinerary);
  }
}

module.exports = Itinerary;
