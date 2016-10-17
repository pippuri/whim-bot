'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const lib = require('./lib');

let nextLegStartTime;

/**
 * Construct response 'from' field
 */
function convertResponseFrom(original) {

  if (!original.response || !original.response.route[0] || !original.response.route[0].waypoint[0]) {
    throw new MaaSError(`Invalid response from HERE: '${JSON.stringify(original.response)}'`, 500);
  }

  return {
    lon: original.response.route[0].waypoint[0].originalPosition.longitude,
    lat: original.response.route[0].waypoint[0].originalPosition.latitude,
  };
}

/**
 * Parse 'place' compatible object from location & road name
 */
function toPlace(position, roadName) {
  return {
    name: typeof roadName === 'string' && roadName.length > 0 ? roadName : undefined,
    // stopId: undefined,
    // stopCode: undefined,
    lat: position.latitude,
    lon: position.longitude,

    // excluded: zoneId, stopIndex, stopSequence, vertexType, arrival, departure
  };
}

/**
 * Parse HERE leg response to MaaS leg format
 */
function convertLeg(original) {
  let legMode;
  nextLegStartTime = original.endTime;
  switch (original.transportLine.type) {
    case '':
      console.error('Empty leg type received from here, converting to walking leg');
      legMode = 'WALK';
      break;
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
      legMode = 'TRAM';
      break;
    case 'trainRegional':
    case 'railRegional':
      legMode = 'TRAIN';
      break;
    case 'busPublic':
    case 'busIntercity':
      legMode = 'BUS';
      break;
    case 'railMetro':
    case 'railMetroRegional':
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

  const HSL_TRAINS  = ['I', 'K', 'N', 'A', 'E', 'L', 'P', 'U', 'X'];

  if (HSL_TRAINS.some(train => train === original.transportLine.lineName)) {
    original.transportLine.companyName = 'HSL';
  }

  return {
    startTime: original.startTime,
    endTime: original.endTime,
    mode: legMode,
    from: toPlace(original.position, original.roadName),
    to: toPlace(original.position, original.nextRoadName),
    legGeometry: {
      points: lib.convertToLegGeometry(original.shape),
    },
    route: original.transportLine.lineName,
    agencyId: original.transportLine.companyName,
  };
}

/**
 * Parse original data into Maas Itinerary format
 * @NOTE arriveBy's behavior not yet functioning properly
 */
function convertItinerary(route, mode, leaveAt, arriveBy) {
  // Start time default as leaveAt, use HERE departure data if exists
  let startTime = new Date(Number(leaveAt)).getTime();
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
      // Here have this weird format that put subway line number as "id" instead of "line" as others
      // FIXME check this again
      if (!data.line) {
        transportLine = route.publicTransportLine.find(line => line.id === data.id);
      } else {
        transportLine = route.publicTransportLine.find(line => line.id === data.line);
      }
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
