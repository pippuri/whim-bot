/**
 * Routing results adapter from TripGo to MaaS. Returns promise for JSON object.
 */
var Promise = require('bluebird');

function convertMode(mode) {
  return mode ? mode.toUpperCase() : undefined;
}

function convertAgencyId(serviceOperator) {
  if (serviceOperator == 'Helsingin seudun liikenne') {
    return 'HSL';
  } else {
    return undefined;
  }
}

function convertFromTo(from) {
  if (!from) return undefined;
  return {
    name: from.address,
    stopCode: from.stopCode,
    lon: from.lng,
    lat: from.lat
  };
}

function convertLeg(segment, original, templates) {
  var template = templates[segment.segmentTemplateHashCode] || {};
  return {
    startTime: segment.startTime*1000,
    endTime: segment.endTime*1000,
    mode: convertMode(template.modeInfo && template.modeInfo.localIcon),
    from: convertFromTo(template.from),
    to: convertFromTo(template.to),
    legGeometry: template.streets && template.streets[0] ? {
      points: template.streets[0].encodedWaypoints
    } : undefined,
    route: segment.serviceNumber,
    routeShortName: segment.serviceNumber,
    routeLongName: segment.serviceName,
    agencyId: convertAgencyId(template.serviceOperator)
  };
}

function convertItinerary(trip, original, templates) {
  return {
    startTime: trip.depart*1000,
    endTime: trip.arrive*1000,
    legs: trip.segments.map(function (segment) {
      return convertLeg(segment, original, templates);
    })
  };
}

module.exports = function (original) {
  var allTrips = [];
  // Build template hashmap
  var templates = {};
  (original.segmentTemplates || []).map(function (template) {
    templates[template.hashCode] = template;
  });
  // Combine groups
  original.groups.map(function (group) {
    allTrips = allTrips.concat(group.trips);
  });
  return Promise.resolve({
    plan: {
      itineraries: allTrips.map(function (trip) {
        return convertItinerary(trip, original, templates);
      })
    }
  });
};
