'use strict';

/**
 * Routing results adapter from Matka to MaaS. Returns promise for JSON object.
 */
const Promise = require('bluebird');
const proj4 = require('proj4');

proj4.defs('EPSG:2393', '+proj=tmerc +lat_0=0 +lon_0=27 +k=1 +x_0=3500000 +y_0=0 +ellps=intl +towgs84=-96.062,-82.428,-121.753,4.801,0.345,-1.376,1.496 +units=m +no_defs');

/**
 * Convert KKJ3 (EPSG:2393) coordinates to Google (WGS84)
 */
function convertKKJ3ToWGS84(x, y) {
  const to = proj4('EPSG:2393', 'WGS84', [x, y]);
  return {
    lon: to[0],
    lat: to[1],
  };
}

function convertMode(mode) {
  return mode;
}

function convertFromTo(xy, name) {
  const coords = xy ? convertKKJ3ToWGS84(xy.x, xy.y) : {};
  return {
    name: name && name.$ ? name.$.val : undefined,
    stopId: undefined,
    stopCode: undefined,
    lon: coords.lon,
    lat: coords.lat,
  };
}

function convertDateTime(date, time) {
  const d = new Date();
  d.setFullYear(date.slice(0, 4));
  d.setMonth(parseInt(date.slice(4, 6), 10) - 1);
  d.setDate(date.slice(6, 8));
  d.setHours(time.slice(0, 2));
  d.setMinutes(time.slice(2, 4));
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d.getTime();
}

function convertLeg(leg) {
  console.log('Leg:', leg);
  const startTime = leg.DEPARTURE ? convertDateTime(leg.DEPARTURE[0].$.date, leg.DEPARTURE[0].$.time) : undefined;
  const endTime = leg.ARRIVAL ? convertDateTime(leg.ARRIVAL[0].$.date, leg.ARRIVAL[0].$.time) : undefined;
  return {
    startTime: startTime,
    endTime: endTime,
    mode: convertMode(leg['#name']),
    from: convertFromTo(leg.$, leg.NAME),
    to: undefined,
    legGeometry: undefined,
    route: undefined,
    routeShortName: undefined,
    routeLongName: undefined,
    agencyId: 'HSL',
  };
}

function convertItinerary(route) {
  const duration = parseFloat(route.LENGTH[0].$.time) * 60 * 1000;
  const startTime = convertDateTime(route.POINT[0].DEPARTURE[0].$.date, route.POINT[0].DEPARTURE[0].$.time);
  const endTime = startTime + duration;
  return {
    startTime: startTime,
    endTime: endTime,
    legs: route.$$.filter(function (leg) { return leg['#name'] !== 'LENGTH';}).map(convertLeg),
  };
}

module.exports = function (original) {
  return Promise.resolve({
    plan: {
      itineraries: original.MTRXML.ROUTE.map(convertItinerary),
    },
  });
};
