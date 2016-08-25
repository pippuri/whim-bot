'use strict';

const MaaSError = require('../../lib/errors/MaaSError.js');

/**
 * Trip stores trip related information through work flow process. In practise trip
 * data is serialized into SWF events during the execution.
 *
 */

const TRIP_REF_TYPE_ITINERARY = 'Itinerary';

module.exports = class Trip {

  /**
   * Constructor validates trip parameters.
   * @param {string} referenceId - id of the thing that the trip originateds, e.g. itinerary id
   * @param {string} referenceType - type of the thing that the trip originates, e.g. itinerary
   * @param {string} identityId - id of the user that the trip is assosiated.
   * @param {number} [endTime] - unix timestamp when the trip is assumend to end
   * @return {}
   */
  constructor(referenceId, referenceType, identityId, endTime) {

    // validate parameters
    if (!referenceId) {
      throw new MaaSError('Cannot create trip without referenceId', 400);
    }
    if ([Trip.REF_TYPE_ITINERARY].indexOf(referenceType) === -1) {
      throw new MaaSError(`Cannot create trip of referenceType '${referenceType}'`, 400);
    }
    if (!identityId) {
      throw new MaaSError('Cannot create trip without identityId', 400);
    }
    if (endTime && typeof(endTime) !== 'number') {
      throw new MaaSError(`Invalid endTime '${endTime}' - expecting unix timestamp (integer)`, 400);
    }

    // set data
    this.referenceId = referenceId;
    this.referenceType = referenceType;
    this.identityId = identityId;
    this.endTime = endTime;
  }

  /**
   * Getter and setters
   */

  // compound reference key, e.g. 'Itinerary.123123123'
  get compoundRefKey() {
    return `${this.referenceType}.${this.referenceId}`;
  }

  static get REF_TYPE_ITINERARY() {
    return TRIP_REF_TYPE_ITINERARY;
  }

  /**
   * Helper to return trip content as javascript object
   */
  toObject() {
    return {
      referenceId: this.referenceId,
      referenceType: this.referenceType,
      identityId: this.identityId,
      endTime: this.endTime,
    };
  }
};
