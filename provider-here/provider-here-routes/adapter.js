'use strict';

const Promise = require('bluebird');
let nextStartTime = 0;
let nextEndTime = 0;
const constructTo = [];
const MaaSError = require('../../lib/errors/MaaSError');
const _ = require('lodash');

const polylineEncoder = require('polyline');

function convertFrom(from) {
  return {
    name: from.roadName,
    stopId: undefined,
    stopCode: undefined,
    lon: from.position.longitude,
    lat: from.position.latitude,

    // excluded: zoneId, stopIndex, stopSequence, vertexType, arrival, departure
  };
}

function convertTo(data) {
  const position = constructTo.shift();
  return {
    name: data.nextRoadName,
    stopId: undefined,
    stopCode: undefined,
    lon: position.longitude,
    lat: position.latitude,

    // excluded: zoneId, stopIndex, stopSequence, vertexType, arrival, departure
  };
}

function mergeTwoPolylines(existingPolyline, newPoints) {
  const decodedExistingPolyline = polylineEncoder.decode(existingPolyline);
  const decodedNewPoints = polylineEncoder.decode(newPoints);

  // Get the last coord from the existing polyline
  const lastCoord = decodedExistingPolyline[decodedExistingPolyline.length - 1];

  const lastCoordArray = [lastCoord];

  // Encode all new coords with coord from exising polyline at the beginning of this new encoding
  decodedNewPoints.unshift(lastCoord);
  const encodedNewPoints = polylineEncoder.encode(decodedNewPoints);

  // Encode the lastCoord inside an Array
  const encodedLastCoordArray = polylineEncoder.encode(lastCoordArray);

  // Find the string of the last coordinate pair, and remove it from the new encoded polyline
  const newPointsWithoutLastCoord = encodedNewPoints.replace(encodedLastCoordArray, '');

  // And stick the new encoded polyline onto the back of the existing polyline
  const finalPolyline = existingPolyline + newPointsWithoutLastCoord;

  return finalPolyline;
}

// Parse from php implementation: http://pastebin.com/b0HKkpM6
function mergePolylines(polylines) {
  let cachedPolyline = polylines[0];
  for (let i = 1; i < polylines.length; i++) {
    cachedPolyline = mergeTwoPolylines(cachedPolyline, polylines[i]);
  }

  return cachedPolyline;
}

function convertToLegGeometry(shapes) {

  // Output: [[12.12,34.23],[11.12,33.23],...]
  const points = shapes.map(val => [Number(val.split(',')[0]), Number(val.split(',')[1])]);
  return polylineEncoder.encode(points);
}

function legGeometry(data) {
  return {
    points: convertToLegGeometry(data.shape),
  };
}

function convertLegType(legType) {
  switch (legType) {
    case 'railLight':
    case 'trainRegional':
    case 'railRegional':
      return 'TRAIN';

    case 'busLight':
    case 'busPublic':
      return 'BUS';

    case 'railMetro':
      return 'SUBWAY';

    case 'carPrivate':
      return 'CAR';

    default:
      throw new MaaSError(`Unknown HERE leg type: ${legType}`, 500);
  }
}

function convertCarLeg(leg, route, startTime, PTL, LGT ) { //PTL: Public Transport Line; LGT: LegType.
  nextStartTime = (nextEndTime === 0 ? nextEndTime + startTime : nextEndTime);
  nextEndTime = nextStartTime + (leg.travelTime * 1000);

  return {
    startTime: nextStartTime,
    endTime: nextEndTime,
    mode: 'CAR',
    from: { name: leg.start.label, stopId: undefined, stopCode: undefined, lat: leg.start.mappedPosition.latitude, lon: leg.start.mappedPosition.longitude },
    to: { lat: leg.end.mappedPosition.latitude, lon: leg.end.mappedPosition.longitude, name: leg.end.label, stopId: undefined, stopCode: undefined },
    legGeometry: {
      points: convertToLegGeometry([`${leg.start.mappedPosition.latitude},${leg.start.mappedPosition.longitude}`, `${leg.end.mappedPosition.latitude},${leg.end.mappedPosition.longitude}`]),
    },
    route: PTL === '' ? undefined : PTL,
    distance: leg.length,
  };
}

/**
 * Merge all maneuver legs into one
 */
function mergeManeuverLegs(legs) {
  if (!(legs instanceof Array)) {
    return Promise.reject(new MaaSError('Input walking legs for combination are not array.', 500));
  }
  if (legs.length === 0) return [];
  // Return an array as input is array

  if (legs.length === 1) return legs;

  if (legs.length > 1 && legs[0].mode !== legs[1].mode) {
    return Promise.reject(new MaaSError('Cannot merge maneuver legs, different mode input', 500));
  }

  return [
    {
      startTime: legs[0].startTime,
      endTime: legs[legs.length - 1].endTime,
      mode: legs[0].mode,
      from: legs[0].from,
      to: legs[legs.length - 1].to,
      legGeometry: {
        points: mergePolylines(legs.map(leg => leg.legGeometry.points)),
      },
      distance: _.sum(legs.map(leg => leg.distance)),
    },
  ];
}

// Group all maneuver legs into 1
function groupManeuverLegs(legs) {
  const result = [];
  let sameModeLegs = [];

  for (let i = 0; i < legs.length - 1; i++) {
    if (legs[i].mode === legs[i + 1].mode) {
      sameModeLegs.push(legs[i]);

      if (i === legs.length - 2) { // eslint-disable-line
        sameModeLegs.push(legs[i + 1]);
        result.push(mergeManeuverLegs(sameModeLegs));
      }
    } else {
      sameModeLegs.push(legs[i]);
      result.push(mergeManeuverLegs(sameModeLegs));
      sameModeLegs = [];

      if (i === legs.length - 2) { // eslint-disable-line
        result.push(mergeManeuverLegs(sameModeLegs));
        result.push([legs[i + 1]]);
      }
    }
  }

  return _.flatten(result);
}

function convertLeg(leg, data, route, startTime, PTL, LGT ) { //PTL: Public Transport Line; LGT: LegType.
  let LegType = '';
  nextStartTime = (nextEndTime === 0 ? nextEndTime + startTime : nextEndTime);
  nextEndTime = nextStartTime + (data.travelTime * 1000);

  //creates "To" node from "From" node by establishing the initial element for "To" - to be the next element of "From" node
  for (let i = 1; i < leg.maneuver.length; i++) {
    constructTo.push(leg.maneuver[i].position);
    if (i === leg.maneuver.length - 1) {
      constructTo.push(leg.maneuver[i].position);
    }
  }

  switch (LGT) {
    case '':
    case 'WALK':
      LegType = 'WALK';
      break;
    case 'CAR':
      LegType = 'CAR';
      break;
    case 'TAXI':
      LegType = 'TAXI';
      break;
    case 'BICYCLE':
      LegType = 'BICYCLE';
      break;
    default:
      LegType = convertLegType(LGT);
  }

  return {
    startTime: nextStartTime,
    endTime: nextEndTime,
    mode: LegType,
    from: convertFrom(data),
    to: convertTo(data),
    legGeometry: legGeometry(data),
    route: PTL === '' ? undefined : PTL,
    distance: parseFloat(data.length),
  };
}

// Here has this weird leg that have no distance and startTime === endTime
function removeRedundantLeg(legs) {
  return legs.filter(leg => {
    return (leg.distance > 0) && (leg.startTime !== leg.endTime);
  });
}

function convertItinerary(route, mode, leaveAt, arriveBy) {
  let startTime = null;
  // Route mode should be only one
  switch (route.mode.transportModes.toString().toUpperCase()) {
    case 'CAR':
    case 'TAXI':
      if (route.startTime) {
        startTime = new Date(parseInt(route.startTime, 10) + 120000);
      } else {
        startTime = new Date(Number(leaveAt) + 120000 ); // Add 2 min prep time for MaaS to prep the booking
      }
      break;
    case 'BICYCLE':
    case 'WALK':
      startTime = leaveAt ? new Date(Number(leaveAt)) : new Date(Date.now());
      break;
    default:
      startTime = new Date(route.summary.departure);
  }
  const result = [];
  let index = 0;
  route.leg.forEach(leg => {

    // car manouvers are turn by turn, so skip the rest
    if (route.mode === 'CAR') {
      result.push(convertCarLeg(leg, route, startTime.getTime(), 'CAR', 'CAR'));
    } else {
      leg.maneuver.forEach(data => {

        let PTL = '';
        let tempType = '';

        if (data._type === 'PublicTransportManeuverType') {
          if (index < route.publicTransportLine.length) {
            PTL = route.publicTransportLine[index].lineName;
            tempType = route.publicTransportLine[index].type;
          }

          if (PTL === '' && data.line !== '') PTL = data.line;
          index++;
        } else if (data._type === 'PrivateTransportManeuverType') {
          switch (mode) {
            case 'CAR':
              tempType = 'CAR';
              break;
            case 'TAXI':
              tempType = 'TAXI';
              break;
            case 'BICYCLE':
              tempType = 'BICYCLE';
              break;
            case 'WALK':
            default:
              tempType = 'WALK';
              break;
          }
        } else {
          tempType = '';
        }

        result.push(convertLeg(leg, data, route, startTime.getTime(), PTL, tempType));
      });
    }

  });

  // Combine all walking legs only when all leg are returned.
  return {
    startTime: startTime.getTime(),
    endTime: startTime.getTime() + (route.summary.travelTime * 1000),
    legs: groupManeuverLegs(removeRedundantLeg(result)),
  };
}

function convertPlanFrom(original) {

  if (!original.response || !original.response.route[0] || !original.response.route[0].waypoint[0]) {
    return new Error('Invalid HERE response.');
  }

  const lon = (original.response.route[0].waypoint[0].originalPosition.longitude);
  const lat = (original.response.route[0].waypoint[0].originalPosition.latitude);

  const from = {
    lon: lon,
    lat: lat,
  };

  return from;

}

module.exports = function (original, mode, leaveAt, arriveBy) {
  return Promise.resolve({
    plan: {
      from: convertPlanFrom(original),
      itineraries: original.response.route.map(route => convertItinerary(route, mode, leaveAt, arriveBy)),
    },
  });
};
