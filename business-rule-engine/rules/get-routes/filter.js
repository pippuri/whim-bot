'use strict';

const MaaSError = require('../../../lib/errors');
const geoDistance = require('../../../lib/geolocation').distance;
const _uniqWith = require('lodash/uniqWith');
const _isEqual = require('lodash/isEqual');

/**
 * Filter out all itinerary that is unpurchasable
 * @param {Object} itineraries - input itineraries list
 * @return {Object} itineraries - filtered itineraries
 */
function filterOutUnpurchasableItinerary(itineraries) {
  return itineraries.filter(itinerary => {
    return itinerary.fare.points !== null;
  });
}

/**
 * Filter itineraries with too large distance gap between bird distance and real route distance
 * @param {Object} itineraries - input itineraries list
 * @param {Float} threshold - distance delta threshold (percentage)
 * @return {Object} itineraries - filtered itineraries
 */
function filterUnsensibleItinerary(itineraries, threshold) {
  const validItineraries = itineraries.filter(iti => {

    if (iti.legs.length === 0) throw new MaaSError('One itinerary has no leg', 500);

    const startLeg = iti.legs[0];
    const endLeg = iti.legs[iti.legs.length - 1];

    const itineraryDistance = iti.legs.reduce((_distance, leg) => {
      if (!leg.distance) {
        return _distance;
      }

      return _distance + leg.distance;
    }, 0);

    // Minimum distance between from and to (haversine)
    const straightDistance = geoDistance(startLeg.from, endLeg.to);
    return (itineraryDistance / straightDistance) <= (threshold / 100);
  });
  return validItineraries;
}

/**
 * Filter out all walking itineraries that is too long using threshold
 * @param {Object} itineraries - input itineraries list
 * @param {Float} walkingThreshold - walking threshold (meter)
 * @return {Object} itineraries - filtered itineraries
 */
function filterLongWalkingItineraries(itineraries, walkingThreshold) {
  // Itineraries without walking legs
  const nonWalkingItineraries = itineraries.filter(iti => iti.legs.every(leg => leg.mode !== 'WALK'));
  // Itineraries with walking leg whose walking distance smaller than threshold
  const filteredWalkingItineraries = itineraries.filter(iti => iti.legs.some(leg => leg.mode === 'WALK'))
    .filter(iti => {
      const walkingDistance = iti.legs
        .filter(leg => leg.mode === 'WALK')
        .reduce((_distance, leg) => {
          if (!leg.distance) return _distance;
          return _distance + leg.distance;
        }, 0);
      return walkingDistance <= walkingThreshold;
    });

  return nonWalkingItineraries.concat(filteredWalkingItineraries);
}

function filterIdenticalItineraries(itineraries) {
  return _uniqWith(itineraries, _isEqual);
}

/**
 * Choose what will be the filtering variable
 * @param {Object} itineraries - input itineraries list
 * @param {Object} options - filtering options
 * @param {Boolean} options.keepUnpurchasable - keep unpurchasable or not
 * @param {Float} options.distanceDeltaThreshold - threshold for short walking itineraries
 * @param {Float} options.longThreshold - threshold for long walking itineraries
 * @return {Object} itineraries - filtered itineraries
 */
function resolve(itineraries, options) {
  if (options.keepUnpurchasable === true) {
    itineraries = filterOutUnpurchasableItinerary(itineraries);
  }

  if (options.distanceDeltaThreshold) {
    if (Number(options.distanceDeltaThreshold) !== options.distanceDeltaThreshold) throw new Error('distanceDeltaThreshold must be a number');
    itineraries = filterUnsensibleItinerary(itineraries, options.distanceDeltaThreshold);
  }

  if (options.longThreshold) {
    if (Number(options.longThreshold) !== options.longThreshold) throw new Error('longThreshold must be a number');
    itineraries = filterLongWalkingItineraries(itineraries, options.longThreshold);
  }

  if (options.removeIdentical === true) {
    itineraries = filterIdenticalItineraries(itineraries);
  }

  return itineraries;
}

module.exports = {
  filterOutUnpurchasableItinerary,
  filterUnsensibleItinerary,
  filterLongWalkingItineraries,
  resolve,
};
