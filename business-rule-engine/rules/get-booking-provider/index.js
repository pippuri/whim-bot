'use strict';

/**
 * This rule is used to decide which provider is used for the pricing based on the location of the customer
 */

const utils = require('../../../lib/utils');
const BookingProvider = require('../../../lib/models').BookingProvider;
const BusinessRuleError = require('../../../lib/errors/BusinessRuleError.js');


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
const getActiveCached = utils.memoizeAsync(getActive);

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
  return locations.every(loc => utils.isPointInsidePolygon(loc, geometry));
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
 * Validate inputs to getBookingProvidersByAgencyAndLocation()
 *
 * @param {Object} params - the input to validate
 *
 * [TODO Should be handled by validator, instead]
 */
function _validateOptionsParamsAgencyAndLocation(params) {
  if (!params.agencyId) {
    throw new BusinessRuleError(`The request does not supply 'agencyId' to the engine: ${JSON.stringify(params)}`, 400, 'get-routes');
  }

  if (!params.hasOwnProperty('from') || Object.keys(params.from).length === 0) {
    throw new BusinessRuleError(`The request does not supply 'from' to the engine: ${JSON.stringify(params)}`, 400, 'get-routes');
  }

  if (!params.hasOwnProperty('to') || Object.keys(params.to).length === 0) {
    throw new BusinessRuleError(`The request does not supply 'to' to the engine: ${JSON.stringify(params)}`, 400, 'get-routes');
  }
}

/**
 * Validate inputs to getBookingProvidersByModeAndLocation()
 *
 * @param {Object} params - the input to validate
 *
 * [TODO Should be handled by validator, instead]
 */
function _validateOptionsParamsModeAndLocation(params) {
  if (!params.mode) {
    throw new BusinessRuleError(`The request does not supply 'mode' to the engine: ${JSON.stringify(params)}`, 400, 'get-routes');
  }

  if (!params.hasOwnProperty('from') || Object.keys(params.from).length === 0) {
    throw new BusinessRuleError(`The request does not supply 'from' to the engine: ${JSON.stringify(params)}`, 400, 'get-routes');
  }

  if (!params.hasOwnProperty('to') || Object.keys(params.to).length === 0) {
    throw new BusinessRuleError(`The request does not supply 'to' to the engine: ${JSON.stringify(params)}`, 400, 'get-routes');
  }
}

/**
 * Get a list of booking providers which match the given bookingProviderQuery
 *
 * NOTE: this uses the memoized version of getActive,
 *       so multiple calls only hit the database once.
 *
 * @param {Object} params - a params object containing 'agencyId', 'from' and 'to' properties
 * @return {Promise} - a promise which resolves to a list of booking providers, sorted in priority order (ASC)
 */
function getBookingProvidersByAgencyAndLocation(params) {
  _validateOptionsParamsAgencyAndLocation(params);

  return getActiveCached()
    .then(ps => ps.filter(_bookingProvidersAgencyIdFilter(params.agencyId)))
    .then(ps => ps.filter(_bookingProvidersLocationFilter([params.from, params.to])));
}

/**
 * Get a list of booking providers which match the given mode and location parameters
 *
 * NOTE: this uses the memoized version of getActive,
 *       so multiple calls only hit the database once.
 *
 * @param {Object} params - a params object containing 'mode', 'from' and 'to' properties
 * @return {Promise} - a promise which resolves to a list of booking providers, sorted in priority order (ASC)
 */
function getBookingProvidersByModeAndLocation(params) {
  _validateOptionsParamsModeAndLocation(params);

  return getActiveCached()
    .then(ps => ps.filter(_bookingProvidersModeFilter(params.mode)))
    .then(ps => ps.filter(_bookingProvidersLocationFilter([params.from, params.to])));
}


module.exports = {
  getActive,
  getActiveCached,
  getBookingProvidersByAgencyAndLocation,
  getBookingProvidersByModeAndLocation,
};
