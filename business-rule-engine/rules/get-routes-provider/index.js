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
 * @param {Object} routesProvidersMap - an object containing lists of routes providers keyed by mode
 * @param {Function} fn - predicate function to determine whether a provider should remain or not
 *
 * @return {Array} - a list of filtered routes providers
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
 * @param {Object} params - the search query we want to perform
 *
 * @param {Object} provider - a routes provider
 *
 * @return {Boolean} - result for filter
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
 * @param {Array} locations - list of [lat,lon] pairs
 *
 * @param {Object} provider - a routes provider
 *
 * @return {Boolean} - result for filter
 */
const routesProvidersLocationFilter = locations => provider => {
  const geometry = JSON.parse(provider.geometry);

  // To be a valid provider, it must be able to cover all the given locations
  return locations.every(loc => utils.isPointInsidePolygon(loc, geometry));
};

/**
 * Fetch all active RoutesProviders from the database, ordered by priority.
 *
 * @return {Promise} - a promise which resolves to a list of database records
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
 * @return {Promise} - a promise which resolves to a list of database records
 */
const getActiveCached = utils.memoizeAsync(getActive);

/**
 * Given a list of routes providers, map each possible mode
 * to a list of routes providers which can handle that mode.
 *
 * @return {Object} - the resulting map
 */
function _mapModesToRoutesProviders(providers) {
  const ret = {};

  // Collect all the modes
  const modes = [];

  // Array.providers.push.apply is a trick to merge the second argument (array)
  // into the first argument (array) using push. The second array is in effect
  // expanded as multiple arguments to array,push
  providers.forEach(provider => Array.prototype.push.apply(modes, provider.modes));

  // Set up an empty list for each distinct mode
  _uniq(modes).forEach(mode => (ret[mode] = []));

  // Put the provider into each mode it applies to
  providers.forEach(provider => {
    provider.modes.forEach(mode => (ret[mode].push(provider)));
  });

  return Object.freeze(ret);
}

/**
 * Return a subset of the given modesToRouteProviders map
 * with only keys from the given list of modes.
 *
 * @return {Object} - the subset
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
 * @param {Array} modesList - a list of mode strings
 *
 * @return {Object} - lists of routes providers keyed by mode
 */
function getRoutesProvidersByModesList(modesList) {
  return getActiveCached()
    .then(providers => _mapModesToRoutesProviders(providers))
    .then(map => _subsetModeToRoutesProvidersMap(map, modesList));
}

module.exports = {
  getActive,
  getActiveCached,
  getRoutesProvidersByModesList,
  filterRoutesProviders,
  routesProvidersCapabilityFilter,
  routesProvidersLocationFilter,
};
