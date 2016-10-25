'use strict';

/**
 * This rule is used to decide which provider is used for the routing system based on the location of the customer
 */

const RoutesProvider = require('../../../lib/models').RoutesProvider;
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
 * Filters a list of providers by a given rule
 *
 * @param {array} providers - A list of providers, returned by a query
 * @param {object} rule - A filtering rule w/ type, name, agencyId & location
 */
function filter(providers, rule) {
  // Validate the rule
  if (typeof rule.type !== 'string' && typeof rule.agencyId !== 'string' && typeof rule.providerName !== 'string') {
    throw new Error('Missing rule parameters: type, agencyId or providerName expected');
  }
  // Filter
  return providers.filter(provider => {
    if (rule.type && rule.type === provider.providerType) {
      // OK
    } else if (rule.agencyId && rule.agencyId === provider.agencyId) {
       // OK
    } else if (rule.providerName && rule.providerName === provider.providerName) {
      // OK
    } else {
       // Not OK
      return false;
    }

    // Geographic match and contain requested mode
    if (rule.location && rule.mode) {
      const geometry = JSON.parse(provider.geometry);
      return isInside(rule.location, geometry) && provider.modes.some(mode => mode === rule.mode);
    }

    return false;
  });
}

function getActive() {
  return RoutesProvider.query()
    .select('RoutesProvider.*', RoutesProvider.raw('ST_AsGeoJSON("RoutesProvider"."the_geom") as geometry'))
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
  return RoutesProvider.query()
    .select('RoutesProvider.*', RoutesProvider.raw('ST_AsGeoJSON("RoutesProvider"."the_geom") as geometry'))
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
