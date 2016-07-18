'use strict';

/**
 * Routing results adapter from TripGo to MaaS. Returns promise for JSON object.
 */
const Promise = require('bluebird');

function convertMode(mode) {
  return mode ? mode.toUpperCase() : undefined;
}

function convertAgencyId(mode, serviceOperator) {

  if (serviceOperator === 'Helsingin seudun liikenne') {
    return 'HSL';
  }

  return undefined;

}

function convertFromTo(from) {
  if (!from) return undefined;
  return {
    name: from.address,
    stopCode: from.stopCode,
    lon: from.lng,
    lat: from.lat,
  };
}

function convertLeg(segment, original, templates) {
  const template = templates[segment.segmentTemplateHashCode] || {};
  const mode = convertMode(template.modeInfo && template.modeInfo.localIcon);
  const leg = {
    startTime: segment.startTime * 1000,
    endTime: segment.endTime * 1000,
    mode: mode,
    from: convertFromTo(template.from),
    to: convertFromTo(template.to),
    route: segment.serviceNumber,
    routeShortName: segment.serviceNumber,
    routeLongName: segment.serviceName,
    agencyId: convertAgencyId(mode, template.serviceOperator),
  };

  // Handle the case of different ways TripGo reports leg geometries
  const streets = template.streets;
  const shapes = template.shapes;
  if (streets && streets[0] && streets[0].encodedWaypoints.length > 0) {
    leg.legGeometry = {
      points: template.streets[0].encodedWaypoints,
    };
  } else if (shapes) {
    const route = shapes.find(s => s.travelled);

    if (route && route.encodedWaypoints.length > 0) {
      leg.legGeometry = {
        points: route.encodedWaypoints,
      };
    }
  }


  return leg;
}

function convertItinerary(trip, original, templates) {
  return {
    startTime: trip.depart * 1000,
    endTime: trip.arrive * 1000,
    legs: trip.segments.map(segment => {
      return convertLeg(segment, original, templates);
    }),
  };
}

function convertPlanFrom(original) {
  let from;
  if (original.groups && original.groups[0] && original.groups[0].trips && original.groups[0].trips[0] && original.groups[0].trips[0].segments && original.groups[0].trips[0].segments[0]) {
    const hashCode = original.groups[0].trips[0].segments[0].segmentTemplateHashCode;
    (original.segmentTemplates || []).map(segmentTemplate => {
      if (segmentTemplate.hashCode === hashCode && typeof segmentTemplate.from === 'object') {

        // Found the starting point
        from = {
          name: segmentTemplate.from.address,
          lon: segmentTemplate.from.lng,
          lat: segmentTemplate.from.lat,
        };
      }

    });
  }

  return from;
}

function compareItinerary(a, b) {
  return a.startTime - b.startTime;
}

module.exports = function (original) {
  let allTrips = [];

  // Build template hashmap
  const templates = {};
  (original.segmentTemplates || []).map(template => {
    templates[template.hashCode] = template;
  });

  // Combine groups
  (original.groups || []).map(group => {
    allTrips = allTrips.concat(group.trips);
  });

  return Promise.resolve({
    plan: {
      from: convertPlanFrom(original),
      itineraries: allTrips.map(trip => {
        return convertItinerary(trip, original, templates);
      }).sort(compareItinerary),
    },
  });
};
