
/**
 * Routing results adapter from Here to MaaS. Returns promise for JSON object.
 */
var Promise = require('bluebird');
var nextStartTime = 0;
var nextEndTime = 0;
var constructTo = [];

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
  var position = constructTo.shift();
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
  var encodeString = '';
  while (num >= 0x20) {
    encodeString += (String.fromCharCode((0x20 | (num & 0x1f)) + 63));
    num >>= 5;
  }

  encodeString += (String.fromCharCode(num + 63));

  return encodeString;
}

function encodeSignedValue(num) {
  var sgn_num = num << 1;
  if (num < 0) {
    sgn_num = ~(sgn_num);
  }

  return (encodeNumber(sgn_num));
}

function encodePoint(plat, plon, lat, lon) {
  var platE5 = Math.round(plat * 1e5);
  var plonE5 = Math.round(plon * 1e5);
  var latE5 = Math.round(lat * 1e5);
  var lonE5 = Math.round(lon * 1e5);

  var dLon = lonE5 - plonE5;
  var dLat = latE5 - platE5;

  return encodeSignedValue(dLat) + encodeSignedValue(dLon);
}

function createEncodedPolyline(points) {

  var plat = 0;
  var plon = 0;

  var encoded_point = '';

  points.forEach(function (val, key) {
    var lat = val[0];
    var lon = val[1];

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
  var points = shapes.map(function (val) {
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
}

function convertLeg(leg, data, route, startTime, PTL, LGT ) { //PTL: Public Transport Line; LGT: LegType.
  var LegType = '';
  nextStartTime = (nextEndTime === 0 ? nextEndTime + startTime : nextEndTime);
  nextEndTime = nextStartTime + (data.travelTime * 1000);

  //creates "To" node from "From" node by establishing the initial element for "To" - to be the next element of "From" node
  for (var i = 1; i < leg.maneuver.length; i++) {
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
  var startTime = new Date(route.summary.departure);
  var result = [];
  var res = '';
  var tempRoute = 0;
  var PTL = '';
  var tempType = '';
  route.leg.map(function (leg) {
    leg.maneuver.forEach(function (data, index) {
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
  var from;

  if (original.response && original.response.route[0] && original.response.route[0].waypoint[0]) {
    var lon = (original.response.route[0].waypoint[0].originalPosition.longitude);
    var lat = (original.response.route[0].waypoint[0].originalPosition.latitude);
    from = {
      lon: lon,
      lat: lat,
    };
    return from;
  }

}

module.exports = function (original) {
  return Promise.resolve({
    plan: {
      from: convertPlanFrom(original),
      itineraries: original.response.route.map(convertItinerary),
    },
  });
};
