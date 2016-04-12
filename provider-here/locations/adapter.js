/**
 * Routing results adapter from Here to MaaS. Returns promise for JSON object.
 */
var Promise = require('bluebird');

function convertMode(mode) {
  return mode == 'publicTransport' ? 'PUBLIC' : undefined;
}

function convertFromTo(from) {
  return {
    name: from.label,
    stopId: undefined,
    stopCode: undefined,
    lon: from.mappedPosition.longitude,
    lat: from.mappedPosition.latitude,
    // excluded: zoneId, stopIndex, stopSequence, vertexType, arrival, departure
  };
}

function convertLeg(leg, route) {
  return {
    startTime: undefined,
    endTime: undefined,
    mode: convertMode(route.mode && route.mode.transportModes && route.mode.transportModes[0]),
    from: convertFromTo(leg.start),
    to: convertFromTo(leg.end),
    legGeometry: undefined,
    route: undefined,
    routeShortName: undefined,
    routeLongName: undefined,
    agencyId: undefined,
  };
}

function convertItinerary(route) {
  return {
    startTime: undefined,
    endTime: undefined,
    legs: route.leg.map(function (leg) {
      return convertLeg(leg, route);
    }),
  };
}

module.exports = function (original) {
  return Promise.resolve({
    plan: {
      itineraries: original.response.route.map(convertItinerary),
    },
  });
};
