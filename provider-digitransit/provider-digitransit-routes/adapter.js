'use strict';

/**
 * Routing results adapter from Digitransit to MaaS. Returns promise for JSON object.
 */
const Promise = require('bluebird');
const utils = require('../../lib/utils');

function convertMode(mode) {
  switch (mode) {
    case 'RAIL':
      mode = 'TRAIN';
      break;
    case 'CAR':
      mode = 'TAXI';
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

function convertAgencyId(input) {
  if (input === 'Helsingin seudun liikenne') {
    return 'HSL';
  }
  return input;
}

function convertLeg(leg) {
  leg = utils.removeNulls(leg);

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
    route: leg.route ? leg.route.shortName : undefined,
    routeShortName: leg.route ? leg.route.shortName : undefined,
    routeLongName: leg.route ? leg.route.longName : undefined,
    agencyId: leg.agency ? convertAgencyId(leg.agency.name) : undefined,
    distance: Math.floor(leg.distance), // used to calculate prices for km-based fares
    // excluded: departureDelay, arrivalDelay, realTime, pathway, agencyUrl, agencyName, agencyTimeZoneOffset,
    // routeType, routeId, interlineWithPreviousLeg, headsign, tripId, serviceDate, rentedBike, transitLeg, steps
  };
}

function convertItinerary(itinerary) {
  return {
    startTime: itinerary.startTime,
    endTime: itinerary.endTime,
    legs: itinerary.legs.map(convertLeg),
    // excluded: walkTime, transitTime, waitingTime, walkDistance, walkLimitExceeded, elevationLost, elevationGained, transfers, tooSloped
  };
}

module.exports = function (from, original) {
  return Promise.resolve({
    plan: {
      from: from,
      itineraries: original.data.plan.itineraries.map(convertItinerary).sort((a, b) => a.startTime - b.startTime),
    },
  });
};
