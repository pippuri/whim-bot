/**
 * Routing results adapter from HSL to MaaS. Returns promise for JSON object.
 */
var BBPromise = require('bluebird');
var proj4 = require('proj4');

proj4.defs('EPSG:2392', '+proj=tmerc +lat_0=0 +lon_0=24 +k=1 +x_0=2500000 +y_0=0 +ellps=intl +units=m +no_defs');

/**
 * Convert KKJ2 (EPSG:2392) coordinates to Google (WGS84)
 */
function convertKKJ2ToWGS84(x, y) {
  var to = proj4('EPSG:2392', 'WGS84', [x, y]);
  return {
    lon: to[0],
    lat: to[1],
  };
}

function convertMode(type) {
  switch (type) {
    case '1':
      return 'TRAM';
    case 'walk':
      return 'WALK';
    default:
      return (type || '').toUpperCase();
  }
}

function convertFromTo(from) {
  var coords = convertKKJ2ToWGS84(from.coord.x, from.coord.y);
  return {
    name: from.name,
    stopId: from.shortCode,
    stopCode: from.code,
    lon: coords.lon,
    lat: coords.lat,
  };
}

function convertDateTime(str) {
  var d = new Date();
  d.setFullYear(str.slice(0, 4));
  d.setMonth(parseInt(str.slice(4, 6)) - 1);
  d.setDate(str.slice(6, 8));
  d.setHours(str.slice(8, 10));
  d.setMinutes(str.slice(10, 12));
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d.getTime();
}

function convertLeg(leg) {
  var startTime = convertDateTime(leg.locs[0].depTime);
  var endTime = startTime + leg.duration * 1000;
  return {
    startTime: startTime,
    endTime: endTime,
    mode: convertMode(leg.type),
    from: convertFromTo(leg.locs[0]),
    to: convertFromTo(leg.locs[leg.locs.length - 1]),
    legGeometry: undefined,
    route: leg.code,
    routeShortName: leg.code,
    routeLongName: leg.code,
    agencyId: 'HSL',
  };
}

function convertItinerary(route) {
  var startTime = convertDateTime(route.legs[0].locs[0].depTime);
  var endTime = startTime + route.duration * 1000;
  return {
    startTime: startTime,
    endTime: endTime,
    legs: route.legs.map(convertLeg),
  };
}

module.exports = function (original) {
  var allRoutes = [];
  original.map(function (routes) {
    routes.map(function (route) {
      allRoutes.push(route);
    });
  });

  return BBPromise.resolve({
    plan: {
      itineraries: allRoutes.map(convertItinerary),
    },
  });
};
