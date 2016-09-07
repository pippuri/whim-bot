'use strict';

const haversine = require('haversine');

/**
 * Computes the haversine distance between two points.
 *
 * @param {object} a {lat, lon} geolocation pair
 * @param {object} b {lat, lon} geolocation pair
 * @return {number} the distance between two points in meters
 */
function distance(a, b) {
  const aConv = {
    latitude: a.lat,
    longitude: a.lon,
  };
  const bConv = {
    latitude: b.lat,
    longitude: b.lon,
  };

  // TODO: unit: 'meter' param does not seem to work
  //return haversine(aConv, bConv, { unit: 'meter' });
  const distance = haversine(aConv, bConv);
  return (Number.isNaN(distance)) ? distance : distance * 1000.0;
}

module.exports = {
  distance,
};
