'use strict';

const geoUtils = require('geojson-utils');

/**
 * Computes the haversine distance between two points.
 *
 * @param {object} a {lat, lon} geolocation pair
 * @param {object} b {lat, lon} geolocation pair
 * @return {number} the distance between two points in meters
 */
function distance(a, b) {
  const aConv = {
    type: 'Point',
    coordinates: [a.lon, a.lat],
  };
  const bConv = {
    type: 'Point',
    coordinates: [b.lon, b.lat],
  };

  return geoUtils.pointDistance(aConv, bConv);
}

module.exports = {
  distance,
};
