'use strict';

/**
 * This rule is used to decide which provider is used for the pricing based on the location of the customer
 */

const BookingProvider = require('../../../lib/models').BookingProvider;
const geoUtils = require('geojson-utils');

/**
 * Checks whether a given point is inside the polygon
 *
 * @param {object} location - a {lat,lon} pair
 * @param {object} polygon - a GeoJSON polygon
 * @return true if it is inside polygon, false otherwise
 */
function isInside(location, polygon) {
  const point = {
    type: 'Point',
    coordinates: [location.lon, location.lat],
  };

  return geoUtils.pointInPolygon(point, polygon);
}

/**
 * Filters all possible providers from the query "from" field
 *
 * @param {array} providers - A list of providers, returned by a query
 * @param {object} rule - A filtering rule w/ type, name, agencyId & location
 */
function filter(providers, rule) {
  // Validate the rule
  if (typeof rule.agencyId !== 'string' && typeof rule.providerName !== 'string') {
    throw new Error('Missing rule parameters: type, agencyId or providerName expected');
  }

  // Filter
  return providers.filter(provider => {
    if (rule.agencyId && rule.agencyId === provider.agencyId) {
       // OK
    } else if (rule.providerName && rule.providerName === provider.providerName) {
      // OK
    } else {
       // Not OK
      return false;
    }

    // Geographic match
    if (rule.from) {
      const geometry = JSON.parse(provider.geometry);
      return isInside(rule.from, geometry);
    }
    return false;
  });
}

function getActive() {
  return BookingProvider.query()
    .select('BookingProvider.*', BookingProvider.raw('ST_AsGeoJSON("BookingProvider"."the_geom") as geometry'))
    .where('active', true)
    .orderBy('providerPrio')
    .then(providers => providers.map(provider => {
      if (provider.the_geom) {
        delete provider.the_geom;
      }
      return provider;
    }));
}

function getAll() {
  return BookingProvider.query()
    .select('BookingProvider.*', BookingProvider.raw('ST_AsGeoJSON("BookingProvider"."the_geom") as geometry'))
    .orderBy('providerPrio')
    .then(providers => providers.map(provider => {
      if (provider.the_geom) {
        delete provider.the_geom;
      }
      return provider;
    }));
}

module.exports = {
  filter,
  getActive,
  getAll,
};
