'use strict';

/**
 * This rule is used to decide which provider is used for the routing system
 * based on the location and other parameters of a given routes query.
 */

const utils = require('../../../lib/utils');
const RoutesProvider = require('../../../lib/models').RoutesProvider;
const _uniq = require('lodash/uniq');


/**
 * Filter the given map of routes providers by those
 * which fulfill the given predicate function.
 *
 * @param routesProvidersMap {Object} an object containing lists of routes providers keyed by mode
 * @param fn {Function} predicate function to determine whether a provider should remain or not
 *
 * @return {Array} of filtered routes providers
 */
function filterRoutesProviders(routesProvidersMap, fn) {
  // New mapping to return after filtering
  const ret = {};

  // Map over each mode and apply the filter to each list of routes providers
  Object.keys(routesProvidersMap).map(mode => {
    ret[mode] = routesProvidersMap[mode].filter(fn);
  });

  return Object.freeze(ret);
}

/**
 * A function to filter routes providers by those
 * which have the capability to fulfill the query specified by the given
 * params object.
 * This function is designed to be curried with the params argument so that
 * it can then be used as a filter predicate with filterRoutesProviders()
 *
 * @param params {Object} param of the search query we want to perform
 *
 * @param provider {Object} a routes provider
 *
 * @return {Function / Boolean} a predicate function or True/False test for a provider
 */
const routesProvidersCapabilityFilter = params => provider => {
  function _hasCapability(provider, capability) {
    return (provider.hasOwnProperty('capabilities') && provider.capabilities[capability] === true);
  }

  if (params.arriveBy && !_hasCapability(provider, 'arriveBy')) {
    return false;
  } else if (params.leaveAt && !_hasCapability(provider, 'leaveAt')) {
    return false;
  }
  return true;
};

/**
 * A function to filter routes providers by those which can operate
 * in the given locations.
 * This function is designed to be curried with the locations argument so that
 * it can then be used as a filter predicate with filterRoutesProviders()
 *
 * @param locations {Array} list of [lat,lon] pairs
 *
 * @param provider {Object} a routes provider
 *
 * @return {Function / Boolean} a predicate function or True/False test for a provider
 */
const routesProvidersLocationFilter = locations => provider => {
  const geometry = JSON.parse(provider.geometry);

  // To be a valid provider, it must be able to cover all the given locations
  return locations.every(loc => utils.isInside(loc, geometry));
};

/**
 * Fetch all active RoutesProviders from the database, ordered by priority.
 *
 * @return {Object} a promise which resolves to a list of database records
 */
function getActive() {
  return RoutesProvider.query()
    .select('gid',
            'providerPrio',
            'active',
            'providerName',
            'providerType',
            'agencyId',
            'options',
            'capabilities',
            'region',
            'modes',
            RoutesProvider.raw('ST_AsGeoJSON("RoutesProvider"."the_geom") as geometry'))
    .where('active', true)
    .orderBy('providerPrio');
}

/**
 * A memoized version of getActive() which will cache the result for future calls
 *
 * @return {Object} a promise which resolves to a list of database records
 */
const getActiveCached = utils.memoizePromise(getActive);

/**
 * Given a list of routes providers, map each possible mode
 * to a list of routes providers which can handle that mode.
 */
function _mapModesToRoutesProviders(providers) {
  const ret = {};

  // Collect all the modes
  const modes = [];
  providers.map(provider => Array.prototype.push.apply(modes, provider.modes));

  // Set up an empty list for each distinct mode
  _uniq(modes).map(mode => (ret[mode] = []));

  // Put the provider into each mode it applies to
  providers.map(provider => {
    provider.modes.map(mode => (ret[mode].push(provider)));
  });

  return Object.freeze(ret);
}

/**
 * Return a subset of the given modesToRouteProviders map
 * with only keys from the given list of modes.
 */
function _subsetModeToRoutesProvidersMap(map, modes) {
  const ret = {};

  // For each mode, get the associated providers and add them to the list
  modes.forEach(mode => (ret[mode] = map[mode]));

  return Object.freeze(ret);
}

/**
 * Return all the routes providers which can handle
 * each of the given modes. The result is an object
 * with each key being a mode, and each value being a list
 * of routes providers for that mode.
 *
 * @param modes {Array} of mode strings
 *
 * @return {Object} of routes providers keyed by mode
 */
function getRoutesProvidersBatch(modes) {
  return getActiveCached()
    .then(providers => _mapModesToRoutesProviders(providers))
    .then(map => _subsetModeToRoutesProvidersMap(map, modes));
}

module.exports = {
  getActive,
  getActiveCached,
  getRoutesProvidersBatch,
  filterRoutesProviders,
  routesProvidersCapabilityFilter,
  routesProvidersLocationFilter,
};
