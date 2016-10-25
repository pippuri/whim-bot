'use strict';

/**
 * Routing results adapter from Digitransit to MaaS. Returns promise for JSON object.
 */
const Promise = require('bluebird');
const utils = require('../../lib/utils');
const WAITING_THRESHOLD = 60; // If there's this number of seconds between 2 legs, inject a waiting leg

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

function convertFromTo(place) {
  return {
    name: place.name,
    stopId: place.stopId,
    stopCode: place.stopCode,
    lon: place.lon,
    lat: place.lat,
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
  };
}

function injectWaitingLegs(itinerary) {
  // Run waiting injection onl when there're more than 1 leg
  if (itinerary.legs && itinerary.legs.length === 1) {
    return itinerary;
  }

  const injectedLegs = [];

  for (let i = 0; i < itinerary.legs.length - 1; i++) {
    injectedLegs.push(itinerary.legs[i]);
    if (itinerary.legs[i + 1].startTime - itinerary.legs[i].endTime >= WAITING_THRESHOLD * 1000) {
      injectedLegs.push({
        startTime: itinerary.legs[i].endTime,
        endTime: itinerary.legs[i + 1].startTime,
        mode: 'WAIT',
      });
    }
  }

  injectedLegs.push(itinerary.legs[itinerary.legs.length - 1]);
  itinerary.legs = injectedLegs;
  return itinerary;
}

function convertItinerary(itinerary) {
  return {
    startTime: itinerary.startTime,
    endTime: itinerary.endTime,
    legs: itinerary.legs.map(convertLeg),
  };
}

module.exports = function (from, original) {
  return Promise.resolve({
    plan: {
      from: from,
      itineraries: original.data.plan.itineraries.map(convertItinerary)
        .sort((a, b) => a.startTime - b.startTime).map(injectWaitingLegs),
    },
  });
};
