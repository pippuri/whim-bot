'use strict';

/**
 * Routing results adapter from Here to MaaS. Returns promise for JSON object.
 */
const Promise = require('bluebird');
let nextStartTime = 0;
let nextEndTime = 0;
const constructTo = [];

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

/* jscs:disable requireCamelCaseOrUpperCaseIdentifiers */
/* eslint-disable no-bitwise */

// https://developers.google.com/maps/documentation/utilities/polylinealgorithm#example

function encodeNumber(num) {
  let encodeString = '';
  while (num >= 0x20) {
    encodeString += (String.fromCharCode((0x20 | (num & 0x1f)) + 63));
    num >>= 5;
  }

  encodeString += (String.fromCharCode(num + 63));

  return encodeString;
}

function encodeSignedValue(num) {
  let sgn_num = num << 1;
  if (num < 0) {
    sgn_num = ~(sgn_num);
  }

  return (encodeNumber(sgn_num));
}

function encodePoint(plat, plon, lat, lon) {
  const platE5 = Math.round(plat * 1e5);
  const plonE5 = Math.round(plon * 1e5);
  const latE5 = Math.round(lat * 1e5);
  const lonE5 = Math.round(lon * 1e5);

  const dLon = lonE5 - plonE5;
  const dLat = latE5 - platE5;

  return encodeSignedValue(dLat) + encodeSignedValue(dLon);
}

function createEncodedPolyline(points) {

  let plat = 0;
  let plon = 0;

  let encoded_point = '';

  points.forEach((val, key) => {
    const lat = val[0];
    const lon = val[1];

    encoded_point += encodePoint(plat, plon, lat, lon);

    plat = lat;
    plon = lon;
  });

  return encoded_point;
}

//--------------------------------------------------------------------------------

/* eslint-enable no-bitwise */
/* jscs:enable requireCamelCaseOrUpperCaseIdentifiers */

function convertToLegGeometry(shapes) {

  // Output: [[12.12,34.23],[11.12,33.23],...]
  const points = shapes.map(val => {
    return JSON.parse('[' + val + ']');
  });

  return createEncodedPolyline(points);
}

function legGeometry(data) {
  return {
    points: convertToLegGeometry(data.shape),
  };
}

function convertLegType(legType) {
  if (legType === 'railLight') {
    return 'RAIL';
  } else if (legType === 'busLight') {
    return 'BUS';
  } else if (legType === 'busPublic') {
    return 'BUS';
  }

  throw new Error('Unknown HERE leg type.');
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
    route: PTL,
    routeShortName: '',
    routeLongName: '',
    agencyId: '',
  };
}

function convertItinerary(route) {
  const startTime = new Date(route.summary.departure);
  const result = [];
  let res = '';
  let tempRoute = 0;
  let PTL = '';
  let tempType = '';
  route.leg.map(leg => {
    leg.maneuver.forEach((data, index) => {
      if (data._type === 'PublicTransportManeuverType') {
        tempRoute < route.publicTransportLine.length ? PTL = route.publicTransportLine[tempRoute].lineName : PTL = '';
        tempRoute < route.publicTransportLine.length ? tempType = route.publicTransportLine[tempRoute].type : tempType = '';
        tempRoute++;
      } else if (data._type === 'PrivateTransportManeuverType') {
        tempType = 'WALK';
      } else {
        tempType = '';
      }

      result.push(convertLeg(leg, data, route, startTime.getTime(), PTL, tempType));
    });

    res = result;
  });

  return {
    startTime: startTime.getTime(),
    endTime: startTime.getTime() + (route.summary.travelTime * 1000),
    legs: res,
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

module.exports = function (original) {
  return Promise.resolve({
    plan: {
      from: convertPlanFrom(original),
      itineraries: original.response.route.map(convertItinerary),
    },
  });
};
