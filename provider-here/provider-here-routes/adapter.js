'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const lib = require('./lib');

let nextLegStartTime;

/**
 * Construct response 'from' field
 */
function convertResponseFrom(original) {

  if (!original.response || !original.response.route[0] || !original.response.route[0].waypoint[0]) {
    return new Error('Invalid HERE response.');
  }

  const lon = (original.response.route[0].waypoint[0].originalPosition.longitude);
  const lat = (original.response.route[0].waypoint[0].originalPosition.latitude);

  return {
    lon: lon,
    lat: lat,
  };

}

/**
 * Parse leg 'from' field from original
 */
function convertLegFrom(position, roadName) {
  return {
    name: roadName ? roadName : '', // eslint-disable-line
    // stopId: undefined,
    // stopCode: undefined,
    lat: position.latitude,
    lon: position.longitude,

    // excluded: zoneId, stopIndex, stopSequence, vertexType, arrival, departure
  };
}

/**
 * Parse leg 'to' field from original
 */
function convertLegTo(position, nextRoadName) {
  return {
    name: nextRoadName,
    // stopId: undefined,
    // stopCode: undefined,
    lon: position.longitude,
    lat: position.latitude,

    // excluded: zoneId, stopIndex, stopSequence, vertexType, arrival, departure
  };
}

/**
 * Parse HERE leg response to MaaS leg format
 */
function convertLeg(original) {
  let route;
  let legMode;
  nextLegStartTime = original.endTime;
  switch (original.transportLine.type) {
    case '':
    case 'WALK':
      legMode = 'WALK';
      break;
    case 'CAR':
      legMode = 'CAR';
      break;
    case 'TAXI':
      legMode = 'TAXI';
      break;
    case 'BICYCLE':
      legMode = 'BICYCLE';
      break;
    case 'railLight':
    case 'trainRegional':
    case 'railRegional':
      legMode = 'TRAIN';
      break;
    case 'busLight':
    case 'busPublic':
      legMode = 'BUS';
      break;
    case 'railMetro':
      legMode = 'SUBWAY';
      break;
    case 'carPrivate':
      legMode = 'CAR';
      break;
    default:
      throw new MaaSError(`Unknown HERE adapter leg type: ${legMode}`, 500);
  }

  if (original.transportLine.companyName && original.transportLine.companyName === 'Helsingin seudun liikenne') {
    original.transportLine.companyName = 'HSL';
  }

  return {
    startTime: original.startTime,
    endTime: original.endTime,
    mode: legMode,
    from: convertLegFrom(original.position, original.roadName),
    to: convertLegTo(original.position, original.nextRoadName),
    legGeometry: {
      points: lib.convertToLegGeometry(original.shape),
    },
    route,
    agencyId: original.transportLine.companyName,
  };
}

/**
 * Parse original data into Maas Itinerary format
 * @NOTE arriveBy's behavior not yet functioning properly
 */
function convertItinerary(route, mode, leaveAt, arriveBy) {
  // Start time default as leaveAt, use HERE departure data if exists
  let startTime = new Date(leaveAt).getTime();

  if (route.summary.departure) {
    startTime = new Date(route.summary.departure).getTime();
  }

  if (mode === 'TAXI') {
    startTime = startTime + 120000; // Add 2 min to startTime if mode is taxi
  }

  // Init next leg startTime
  nextLegStartTime = startTime;

  const legs = route.leg[0].maneuver.map(data => {
    let transportLine = {};

    if (data._type === 'PublicTransportManeuverType') {
      // Map public mode depends on HERE response
      transportLine = route.publicTransportLine.find(line => line.id === data.line);
    } else if (data._type === 'PrivateTransportManeuverType') {
      // Map private mode depends on request
      switch (mode) {
        case 'CAR':
          transportLine.type = 'CAR';
          break;
        case 'TAXI':
          transportLine.type = 'TAXI';
          break;
        case 'BICYCLE':
          transportLine.type = 'BICYCLE';
          break;
        case 'WALK':
        default:
          transportLine.type = 'WALK';
          break;
      }
    } else {
      transportLine.type = '';
    }
    return convertLeg({
      startTime: nextLegStartTime,
      endTime: nextLegStartTime + data.travelTime * 1000,
      position: data.position,
      roadName: data.roadName,
      nextRoadName: data.nextRoadName,
      shape: data.shape,
      transportLine: transportLine,
    });
  });

  return {
    startTime: startTime,
    endTime: startTime + route.summary.travelTime * 1000,
    legs: lib.groupManeuverLegs(lib.removeRedundantLeg(legs)),
  };
}

module.exports = function (original, mode, leaveAt, arriveBy) {
  return {
    plan: {
      from: convertResponseFrom(original),
      itineraries: original.response.route.map(route => convertItinerary(route, mode, leaveAt, arriveBy)),
    },
  };
};
