'use strict';

/**
 * Routing results adapter from Digitransit to MaaS. Returns promise for JSON object.
 */
const Promise = require('bluebird');

function convertMode(mode) {
  switch (mode) {
    case 'RAIL':
      mode = 'TRAIN';
      break;
    default:
      break;
  }
  return mode;
}

function convertFromTo(from) {
  return {
    name: from.name,
    stopId: from.stopId,
    stopCode: from.stopCode,
    lon: from.lon,
    lat: from.lat,

    // excluded: zoneId, stopIndex, stopSequence, vertexType, arrival, departure
  };
}

function convertLeg(leg) {
  let agencyId = 'HSL';
  if (leg.mode === 'WALK') {
    agencyId = undefined;
  }

  return {
    startTime: leg.startTime,
    endTime: leg.endTime,
    mode: convertMode(leg.mode),
    from: convertFromTo(leg.from),
    to: convertFromTo(leg.to),
    legGeometry: leg.legGeometry ? {
      points: leg.legGeometry.points,
      length: leg.legGeometry.length,
    } : undefined,
    route: leg.route !== '' ? leg.route : undefined,
    routeShortName: leg.routeShortName,
    routeLongName: leg.routeLongName,
    agencyId: agencyId === '' ? undefined : agencyId, // HSL hardcoded in digitransit
    distance: Math.floor(leg.distance), // used to calculate prices for km-based fares
    duration: leg.duration,
    // excluded: departureDelay, arrivalDelay, realTime, pathway, agencyUrl, agencyName, agencyTimeZoneOffset,
    // routeType, routeId, interlineWithPreviousLeg, headsign, tripId, serviceDate, rentedBike, transitLeg, steps
  };
}

function convertItinerary(itinerary) {
  return {
    startTime: itinerary.startTime,
    endTime: itinerary.endTime,
    legs: itinerary.legs.map(convertLeg),
    duration: itinerary.duration,
    // excluded: walkTime, transitTime, waitingTime, walkDistance, walkLimitExceeded, elevationLost, elevationGained, transfers, tooSloped
  };
}

function convertPlanFrom(from) {
  if (!from) return undefined;
  return {
    name: from.name,
    lon: from.lon,
    lat: from.lat,
  };
}

function compareItinerary(a, b) {
  return a.startTime - b.startTime;
}

module.exports = function (original) {
  if (typeof original.plan === typeof undefined) {

    // Handle 404 - no routes found, this is not error in our system
    if (original.error && original.error.id === 404) {
      const coords = original.requestParameters.fromPlace
        .split(',')
        .map(parseFloat);

      return Promise.resolve({
        plan: {
          from: { lat: coords[0], lon: coords[1] },
          itineraries: [],
        },
        debug: {
          error: original.error,
        },
      });
    }

    // Throw Error on all other cases
    return Promise.reject(new Error('Invalid Digitransit query'));
  }

  return Promise.resolve({
    plan: {
      from: convertPlanFrom(original.plan.from),
      itineraries: original.plan.itineraries.map(convertItinerary).sort(compareItinerary),
    },

    // excluded: requestParameters, debugOutput
  });
};
