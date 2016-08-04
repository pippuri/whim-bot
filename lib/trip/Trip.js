'use strict';

const MaaSError = require('../../lib/errors/MaaSError.js');

/**
 * Trip stores trip related information through work flow process. In practise trip
 * data is serialized into SWF events during the execution.
 *
 */
module.exports = class Trip {

  /**
   * Constructor validates trip parameters.
   * @param {props.referenceId} reference id of the thing that the trip originateds, e.g. itinerary id
   * @param {props.referenceType} reference type of the thing that the trip originates, e.g. itinerary
   * @param {props.endTime} unix timestamp when the trip is assumend to end
   * @return {}
   */
  constructor(props) {

    // validate parameters
    if (!props.referenceId) {
      throw new MaaSError(`Cannot create trip without referenceId`, 400);
    }
    if (['itinerary'].indexOf(props.referenceType) === -1) {
      throw new MaaSError(`Cannot create trip of referenceType '${props.referenceType}'`, 400);
    }
    if (!props.endTime || typeof(props.endTime) !== 'number') {
      throw new MaaSError('Cannot create trip without endTime (unix timestamp)', 400);
    }
    if (!props.identityId) {
      throw new MaaSError(`Cannot create trip without identityId`, 400);
    }

    // set data
    this.props = Object.assign({}, props);

  }

  /**
   * Getter and setters
   */
  get reference() {
    return `${this.props.referenceType}.${this.props.referenceId}`
  }

  get referenceType() {
    return this.props.referenceType;
  }

  get referenceId() {
    return this.props.referenceId;
  }

  get identityId() {
    return this.props.identityId;
  }

  /**
   * Helper to return trip content as javascript object
   */
  toObject() {
    return this.props;
  }

}
