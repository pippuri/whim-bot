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
    arrival: from.arrival,
    departure: from.departure
    // excluded: zoneId, stopIndex, stopSequence, vertexType
  };
}

function convertLeg(leg) {
  return {
    duration: leg.duration,
    startTime: leg.startTime,
    endTime: leg.endTime,
    distance: leg.distance,
    mode: convertMode(leg.mode),
    from: convertFromTo(leg.from),
    to: convertFromTo(leg.to),
    legGeometry: leg.legGeometry ? {
      points: leg.legGeometry.points,
      length: leg.legGeometry.length
    } : undefined,
    route: leg.route != '' ? leg.route : undefined,
    routeShortName: leg.routeShortName,
    routeLongName: leg.routeLongName,
    agencyId: leg.agencyId
    // excluded: departureDelay, arrivalDelay, realTime, pathway, agencyUrl, agencyName, agencyTimeZoneOffset,
    // routeType, routeId, interlineWithPreviousLeg, headsign, agencyId, tripId, serviceDate, rentedBike, transitLeg, steps
  };
}

function convertItinerary(itinerary) {
  return {
    duration: itinerary.duration,
    startTime: itinerary.startTime,
    endTime: itinerary.endTime,
    legs: itinerary.legs.map(convertLeg)
    // excluded: walkTime, transitTime, waitingTime, walkDistance, walkLimitExceeded, elevationLost, elevationGained, transfers, tooSloped
  };
}

module.exports = function (original) {
  return Promise.resolve({
    plan: {
      itineraries: original.plan.itineraries.map(convertItinerary)
    }
    // excluded: requestParameters, debugOutput
  });
};
