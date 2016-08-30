'use strict';

const Promise = require('bluebird');
const utils = require('../utils');
const mock = require('./booking-mock.json');

/**
 * An encapsulation of Itinerary that handles the operations
 * to create, retrieve, list and cancel the itinerary.
 */
class Booking {

  /**
   * A factory method that constructs the itinerary from a DAO
   *
   * @param {object} booking a raw booking object (e.g. JSON object)
   */
  constructor(booking) {
    // Assign the data object with a frozen copy
    this.booking = booking;
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
    return Promise.resolve(new Booking(mock));
  }

  static query(params) {
    return Promise.resolve([new Booking(mock)]);
  }

  reserve() {
    return Promise.resolve(mock);
  }

  cancel() {
    return Promise.resolve();
  }

  toJSON() {
    return utils.cloneDeep(this.booking);
  }
}

module.exports = Booking;
