'use strict';

const MaaSError = require('../../../lib/errors');
const geoDistance = require('../../../lib/geolocation').distance;

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
 * Allows only those routes distance
 * @param {Object} itineraries - input itineraries list
 * @param {Float} threshold - distance threshold (percentage)
 * @return {Object} itineraries - filtered itineraries
 */
function filterShortDistanceItinerary(itineraries, threshold) {
  const validItineraries = itineraries.filter(iti => {
    let startLeg;
    let endLeg;

    switch (iti.legs.length) {
      case 0:
        throw new MaaSError('One itinerary has no leg', 500);
      case 1:
        startLeg = endLeg = iti.legs[0];
        break;
      default:
        startLeg = iti.legs[0];
        endLeg = iti.legs[iti.legs.length - 1];
        break;
    }

    const itineraryDistance = iti.legs.reduce((prev, curr) => {
      if (!prev.distance) {
        if (!curr.distance) {
          return 0;
        }
        return curr.distance;
      }

      if (!curr.distance) {
        return prev.distance;
      }

      return curr.distance + prev.distance;
    }, 0);

    // Minimum distance between from and to (haversine)
    const straightDistance = geoDistance(startLeg.from, endLeg.to);
    console.log(itineraryDistance / straightDistance);
    console.log(threshold / 100);
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
  const nonWalkingItineraries = itineraries.filter(iti => !iti.legs.some(leg => leg.mode === 'WALK'));

  // Itineraries with walking leg whose walking distance smaller than threshold
  const filteredWalkingItineraries = itineraries.filter(iti => iti.legs.some(leg => leg.mode === 'WALK'))
    .filter(iti => {
      const walkingDistance = iti.legs.filter(leg => leg.mode === 'WALK').reduce((prev, curr) => {
        if (!prev.distance) {
          if (!curr.distance) return 0;
          return curr.distance;
        }

        if (!curr.distance) return prev.distance;
        return prev.distance + curr.distance;
      }, 0);
      return walkingDistance <= walkingThreshold;
    });

  return nonWalkingItineraries.concat(filteredWalkingItineraries);
}

/**
 * Choose what will be the filtering variable
 * @param {Object} itineraries - input itineraries list
 * @param {Object} options - filtering options
 * @param {Boolean} options.keepUnpurchasable - keep unpurchasable or not
 * @param {Float} options.shortThreshold - threshold for short walking itineraries
 * @param {Float} options.longThreshold - threshold for long walking itineraries
 * @return {Object} itineraries - filtered itineraries
 */
function resolve(itineraries, options) {
  if (options.keepUnpurchasable === true) {
    itineraries = filterOutUnpurchasableItinerary(itineraries);
  }

  if (options.shortThreshold && Number(options.shortThreshold) === options.shortThreshold) {
    itineraries = filterShortDistanceItinerary(itineraries, options.shortThreshold);
  }

  if (options.shortThreshold && Number(options.longThreshold) === options.longThreshold) {
    itineraries = filterLongWalkingItineraries(itineraries, options.longThreshold);
  }

  return itineraries;
}

module.exports = {
  filterOutUnpurchasableItinerary,
  filterShortDistanceItinerary,
  filterLongWalkingItineraries,
  resolve,
};
