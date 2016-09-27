'use strict';

const Promise = require('bluebird');
let nextStartTime = 0;
let nextEndTime = 0;
const constructTo = [];
const MaaSError = require('../../lib/errors/MaaSError');
const _ = require('lodash');

const polylineEncoder = require('polyline');

/*
function convertMode(data) {

  //strip out html tag from instruction
  return (data.instruction).replace(/(<([^>]+)>)/ig, '');
}
*/

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

function combineWalkingLeg(legs) {
  if (!(legs instanceof Array)) {
    return Promise.reject(new MaaSError('Input walking legs for combination are not array.', 500));
  }
  if (legs.length === 0) return [];
  // Return an array as input is array
  return [
    {
      startTime: legs[0].startTime,
      endTime: legs[legs.length - 1].endTime,
      mode: 'WALK',
      from: legs[0].from,
      to: legs[legs.length - 1].to,
      legGeometry: {
        points: mergePolylines(legs.map(leg => leg.legGeometry.points)),
      },
      distance: _.sum(legs.map(leg => leg.distance)),
    },
  ];
}

// Input walk leg should be in chronological order
function convertWalkLeg(legs) {
  const result = [];
  let walkLegs = [];
  // Group them onto different sub walkLegs for each walkLegs of serial walking legs
  legs.forEach((leg, index) => {
    if (leg.mode === 'WALK') {
      walkLegs.push(leg);
      if (index === legs.length - 1) {
        result.push(combineWalkingLeg(walkLegs));
        // result.push(walkLegs);
        walkLegs = [];
      }
    } else {
      result.push(combineWalkingLeg(walkLegs));
      // result.push(walkLegs);
      result.push([leg]);
      walkLegs = [];
    }
  });
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

  if (LGT === '' || LGT === 'WALK') {
    LegType = 'WALK';
  } else if (LGT === 'CAR') {
    LegType = 'CAR';
  } else {
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

// Here has this weird bus leg that have no distance and startTime === endTime
function removeRedundantLeg(legs) {
  return legs.filter(leg => {
    return (leg.distance > 0) && (leg.startTime !== leg.endTime);
  });
}

function convertItinerary(route) {
  let startTime = null;
  if (route.mode === 'CAR') {
    if (route.startTime) {
      startTime = new Date(parseInt(route.startTime, 10) + 120000 );
    } else {
      console.warn('TODO: There is no start time on the route', JSON.stringify(route, null, 2));
    }
  } else {
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
          tempType = 'WALK';
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
    legs: convertWalkLeg(removeRedundantLeg(result)),
    // legs: removeRedundantLeg(result),
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

  // TODO filter by mode
  return Promise.resolve({
    plan: {
      from: convertPlanFrom(original),
      itineraries: original.response.route.map(convertItinerary),
    },
  });
};
