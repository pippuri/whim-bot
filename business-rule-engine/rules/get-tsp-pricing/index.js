'use strict';

/**
 * Get the tsp pricing based on which tsp it is
 * Parameters
 *      - type {String}
 *      - method {String}
 *      - startTime {Float}
 *      - endTime {Float}
 *      - from {Object} start of the leg
 *      - to {Object} end of the leg (not used)
 *      - userProfile {Object}
 */

const Promise = require('bluebird');
const bookingProviderRules = require('../get-booking-provider');
const utils = require('../../../lib/utils');
const _flatten = require('lodash/flatten');

/**
 * Test if the given booking provider's service is included in the
 * given profile's subscription.
 *
 * [TODO: many things, these logic checks are not enough]
 *
 * @param {Object} profile - a user profile
 * @param {Object} bookingProvider - a booking provider to test
 * @return {Boolean}
 */
function _isIncludedInSubscription(profile, bookingProvider) {
  return (
    // Agency is included in plan
    profile
      .subscription
      .agencies
      .some(agency => agency === bookingProvider.agencyId) &&
    // NOTE below is temporary method.
    bookingProvider.ticketName === 'Helsinki' &&
    bookingProvider.providerPrio === 1); // Give free ticket only to single region
}

/**
 * Give profile free service from agencyId if included in profile subscription.
 *
 * @param {Object} profile - a user profile
 * @param {Object} bookingProvider - a booking provider to test
 * @return {Object} - the bookingProvider, possibly updated if necessary
 */
function _setProfileSpecificPricing(profile, bookingProvider) {
  // If the booking provider is included as part of the subscription
  if (_isIncludedInSubscription(profile, bookingProvider)) {
    // Make a copy to amend
    const ret = utils.cloneDeep(bookingProvider);

    // Set the costs to zero
    ret.value = 0;
    ret.baseValue = 0;

    // Return the amended copy
    return Object.freeze(ret);
  }

  // Return the bookingProvider unchanged
  return bookingProvider;
}

/**
 * Process a single booking provider to perform profile-specific transformations
 *
 * NOTE: this funciton is designed to be curried on the first two arguments
 *       to make is convenient to use as a map funciton on a list of booking providers.
 *
 * @param {Object} profile - a user profile
 * @param {Object} query - the query parameters which yielded the bookingProvider
 * @param {Object} bookingProvider - the booking provider to process
 */
const _processBookingProvider = (profile, query) => bookingProvider => {
  if (typeof bookingProvider === typeof undefined) {
    console.warn(`Could not find pricing provider for ${JSON.stringify(query)}`);
    return null;
  }

  // Set any profile-specific options/amendments and return
  return _setProfileSpecificPricing(profile, bookingProvider);
};

/**
 * Get all geographically relevant booking providers along with pricing information
 *
 * [TODO: make this use the new TSP API to query for options in real time
 *        and provide customized results to a given user]
 *
 * @param {Object} params - query parameters
 * @param {Object} profile - a user profile
 * @return {Promise} - a promise which resolves to a list of suitable booking provider
 */
function getOptions(params, profile) {
  return bookingProviderRules.getBookingProvidersByAgencyAndLocation(params)
    .then(providers => providers.map(_processBookingProvider(profile, params)));
}

/**
 * Get the geographically relevant booking provider along with pricing information
 * for a list of input queries.
 *
 * [TODO: make this use the new TSP API to query for options in real time
 *        and provide customized results to a given user]
 *
 * @param {Object} paramsList - a list of query parameters
 * @param {Object} profile - a user profile
 * @return {Promise} - a promise which resolves to a list of suitable booking providers
 */
function getOptionsBatch(paramsList, profile) {
  return Promise.map(paramsList, params => getOptions(params, profile))
      .then(results => Object.freeze(_flatten(results)));
}

module.exports = {
  getOptions,
  getOptionsBatch,
};
