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

function mergeParkingLegs(itinerary) {
  itinerary.legs = itinerary.legs.filter((leg, index) => leg.mode !== 'PARKING' && index !== itinerary.legs[itinerary.legs.length - 1]);
  return itinerary;
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
    route: segment.serviceNumber === '' ? undefined : segment.serviceNumber,
    routeShortName: segment.serviceNumber === '' ? undefined : segment.serviceNumber,
    routeLongName: segment.serviceName === '' ? undefined : segment.serviceName,
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
  return mergeParkingLegs({
    startTime: trip.depart * 1000,
    endTime: trip.arrive * 1000,
    legs: trip.segments.map(segment => convertLeg(segment, original, templates)),
  });
}

function compareItinerary(a, b) {
  return a.startTime - b.startTime;
}

module.exports = function (original, eventFrom) {
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

  // If we got no trips, we can't use the 'from' from TripGo output.
  // Hence we'll rely on the Input
  return Promise.resolve({
    plan: {
      from: eventFrom,
      itineraries: allTrips.map(trip => {
        return convertItinerary(trip, original, templates);
      }).sort(compareItinerary),
    },
  });
};
