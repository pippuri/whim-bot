'use strict';

/**
 * This rule is used to decide which provider is used for the routing system.
 * Based on the location of the customer will it be decided upon
 * get-provider rule provides method in
 *      - Single mode
 *      - Batch mode
 * Input parameters
 *      - type {String} - type of the requested tsp
 *      - agencyId {String}
 */
const Promise = require('bluebird');
const geoUtils = require('geojson-utils');
const models = require('../../../lib/models/index');
const utils = require('../../../lib/utils');
const Provider = models.Provider;
const BusinessRuleError = require('../../BusinessRuleError.js');

// Static provider cache to speed up queries, refreshes every 5min.
let cachedProviders;
let cacheLastUpdated = 0;
const cacheTTL = 5 * 60 * 1000;

/**
 * Fetches all the providers from database and caches the result.
 *
 * @return {Array} of providers
 */
function queryProviders() {
  if (Date.now() < (cacheLastUpdated + cacheTTL)) {
    return Promise.resolve(utils.cloneDeep(cachedProviders));
  }

  // Fetch all providers - it is a small batch, and much quicker than
  // running several SQL queries
  return Provider.query()
    .select('Provider.*', Provider.raw('ST_AsGeoJSON("Provider"."the_geom") as geometry'))
    .where('active', true)
    .orderBy('providerPrio')
    .then(providers => {
      cacheLastUpdated = Date.now();
      cachedProviders = providers;
      return utils.cloneDeep(cachedProviders);
    });
}

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
 * Filters a a list of providers by a given rule
 *
 * @param {array} providers - A list of providers, returned by a query
 * @param {object} rule - A filtering rule w/ type, name, agencyId & location
 */
function filterProviders(providers, rule) {
  // Validate the rule
  if (typeof rule.type !== 'string' && typeof rule.agencyId !== 'string'
  && typeof rule.providerName !== 'string') {
    throw new BusinessRuleError('Missing rule parameters: type, agencyId or providerName expected', 500, 'get-provider');
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

    // Geographic match
    if (rule.location) {
      const geometry = JSON.parse(provider.geometry);
      return isInside(rule.location, geometry);
    }
    return true;
  });
}

/**
 * Get single provider using either providerName or agencyId
 * @param params {Object} contains providerName {String}, agencyId{String}, type{String}, location{Object}
 * @return {Object} provider
 */
function getProvider(params) {
  return queryProviders()
    .then(providers => filterProviders(providers, params));
}

/**
 * Get provider in batch mode
 * @param requests {Object / Array}
 * @return providers {Object / Array} typeof response depends on type of requests
 *
 * NOTE If input is object, it should have keys which have value is an array of requests
 * check get-routes/routes.js/_resolveRoutesProviders() for reference
 */
function getProviderBatch(requests) {
  // Handling of types [{<request data>}, {<request data>}]
  if (requests instanceof Array) {
    // Fetch all providers - it is a small batch, and much quicker than
    // running several SQL queries
    return queryProviders()
      .then(providers => {
        return requests.map(request => {
          return filterProviders(providers, request);
        });
      });
  }

  // Handling of types { key: [<request data>], [key2: <request data>] }
  if (typeof requests === 'object') {
    const queries = {};
    const keys = Object.keys(requests);

    if (keys.length === 0) {
      return Promise.reject(new BusinessRuleError('Request with no keys given'));
    }

    keys.forEach(key => {
      queries[key] = getProviderBatch(requests[key]);
    });

    return Promise.props(queries);
  }

  return Promise.reject(new BusinessRuleError('Invalid request, expecting array or object'));
}

module.exports = {
  getProvider,
  getProviderBatch,
};
