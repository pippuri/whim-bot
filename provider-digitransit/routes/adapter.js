/**
 * Routing results adapter from Digitransit to MaaS. Returns promise for JSON object.
 */
var Promise = require('bluebird');

function convertMode(mode) {
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
    agencyId: leg.agencyId,
    // excluded: distance, duration, departureDelay, arrivalDelay, realTime, pathway, agencyUrl, agencyName, agencyTimeZoneOffset,
    // routeType, routeId, interlineWithPreviousLeg, headsign, agencyId, tripId, serviceDate, rentedBike, transitLeg, steps
  };
}

function convertItinerary(itinerary) {
  return {
    startTime: itinerary.startTime,
    endTime: itinerary.endTime,
    legs: itinerary.legs.map(convertLeg),
    // excluded: duration, walkTime, transitTime, waitingTime, walkDistance, walkLimitExceeded, elevationLost, elevationGained, transfers, tooSloped
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
    return Promise.reject(new Error('No Digitransit plan received for these parameters'));
  }

  return Promise.resolve({
    plan: {
      from: convertPlanFrom(original.plan.from),
      itineraries: original.plan.itineraries.map(convertItinerary).sort(compareItinerary),
    },
    // excluded: requestParameters, debugOutput
  });
};
