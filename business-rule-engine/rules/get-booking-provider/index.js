'use strict';

/**
 * This rule is used to decide which provider is used for the pricing based on the location of the customer
 */

const utils = require('../../../lib/utils');
const Promise = require('bluebird');
const BookingProvider = require('../../../lib/models').BookingProvider;


/**
 * Fetch all active RoutesProviders from the database, ordered by priority.
 *
 * @return {Object} a promise which resolves to a list of database records
 */
function getActive() {
  return BookingProvider.query()
    .select('gid',
            'providerPrio',
            'active',
            'providerName',
            'agencyId',
            'modes',
            'type',
            'value',
            'baseValue',
            'validFor',
            'payableUntil',
            'bookableUntil',
            'region',
            'ticketName',
            'aliases',
            BookingProvider.raw('ST_AsGeoJSON("BookingProvider"."the_geom") as geometry'))
    .where('active', true)
    .orderBy('providerPrio');
}


/**
 * A memoized version of getActive() which will cache the result for future calls
 *
 * @return {Promise} - a promise which resolves to a list of database records
 */
const getActiveCached = utils.memoizePromise(getActive);

/**
 * A function to filter booking providers by those which can service
 * in the given locations.
 *
 * This function is designed to be curried with the locations argument so that
 * it can then be used as a filter predicate with filterBookingProviders()
 *
 * @param {Array} locations - list of [lat,lon] pairs
 * @param {Object} provider - a booking provider
 * @return {Boolean} - result for filter
 */
const _bookingProvidersLocationFilter = locations => provider => {
  const geometry = JSON.parse(provider.geometry);

  // To be a valid provider, it must be able to cover all the given locations
  return locations.every(loc => utils.isInside(loc, geometry));
};

/**
 * A function to filter booking providers by agencyId
 *
 * This function is designed to be curried with the agencyId argument so that
 * it can then be used as a filter predicate with filterBookingProviders()
 *
 * @param {String} agencyId
 * @param {Object} provider - a booking provider
 * @return {Boolean} - result for filter
 */
const _bookingProvidersAgencyIdFilter = agencyId => provider => {
  // To be a valid provider, it must be match the given agencyId
  return (provider.agencyId === agencyId);
};

/**
 * A function to filter booking providers by mode
 *
 * This function is designed to be curried with the mode argument so that
 * it can then be used as a filter predicate with filterBookingProviders()
 *
 * @param {String} mode
 * @param {Object} provider - a booking provider
 * @return {Boolean} - result for filter
 */
const _bookingProvidersModeFilter = mode => provider => {
  // To be a valid provider, it must be match the given agencyId
  return (provider.modes.indexOf(mode) !== -1);
};

/**
 * Get a list of booking providers which match the given bookingProviderQuery
 *
 * NOTE: this uses the memoized version of getActive,
 *       so multiple calls only hit the database once.
 *
 * @param {Object} bookingProviderQuery - a query which has at least agencyId, from and to properties
 * @return {Promise} - a promise which resolves to a list of booking providers, sorted in priority order (ASC)
 */
function getBookingProviders(bookingProviderQuery) {
  return getActiveCached()
    .then(bookingProviders => (
          bookingProviders
            .filter(_bookingProvidersAgencyIdFilter(bookingProviderQuery.agencyId))))
    .then(bookingProviders => (
          bookingProviders
            .filter(_bookingProvidersLocationFilter([bookingProviderQuery.from]))))
    .then(bookingProviders => Object.freeze(bookingProviders));
}

/**
 * Get a list of booking providers which match the given mode and location parameters
 *
 * NOTE: this uses the memoized version of getActive,
 *       so multiple calls only hit the database once.
 *
 * @param {String} mode - a mode string, e.g. 'TAXI'
 * @param {Object} from - a location object in the form { lat: y, lon: x }
 * @param {Object} to - a location object in the form { lat: y, lon: x }
 * @return {Promise} - a promise which resolves to a list of booking providers, sorted in priority order (ASC)
 */
function getBookingProvidersByModeAndLocation(mode, from, to) {
  return getActiveCached()
    .then(bookingProviders => (
          bookingProviders
            .filter(_bookingProvidersModeFilter(mode))))
    .then(bookingProviders => (
          bookingProviders
            .filter(_bookingProvidersLocationFilter([from, to]))))
    .then(bookingProviders => Object.freeze(bookingProviders));
}

/**
 * Get a single booking provider which matches the given bookingProviderQuery
 *
 * @param {Object} bookingProviderQuery - a query which has at least agencyId, from and to properties
 * @return {Promise} - a promise which resolves to a booking provider
 */
function getBookingProvider(bookingProviderQuery) {
  return getBookingProviders(bookingProviderQuery)
    .then(bookingProviders => bookingProviders.filter(item => (typeof item !== typeof undefined)))
    .then(bookingProviders => bookingProviders[0]);
}

/**
 * Get a list of booking providers which matches a given list of bookingProviderQueries
 *
 * @param {Array} bookingProviderQueryList - a list of bookingProviderQuery objects which each have at least agencyId, from and to properties
 * @return {Promise} - a promise which resolves to a list of booking providers
 */
function getBookingProvidersBatch(bookingProviderQueryList) {
  return Promise.map(bookingProviderQueryList, getBookingProvider)
    .then(result => result.filter(item => (typeof item !== typeof undefined)));
}

module.exports = {
  getActive,
  getActiveCached,
  getBookingProvider,
  getBookingProvidersBatch,
  getBookingProvidersByModeAndLocation,
};
