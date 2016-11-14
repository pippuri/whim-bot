'use strict';

/**
 * This rule is used to retrieve routing/booking provider based on the location of the customer
 * get-provider rule provides method in
 *      - Single mode
 *      - Batch mode
 */

const Promise = require('bluebird');
const utils = require('../../../lib/utils');
const bookingProviders = require('./booking-providers');

// Static provider cache to speed up queries, refreshes every 5min.
let cachedBookingProviders = {};
let bookingCacheLastUpdated = 0;
// const cacheTTL = 2 * 60 * 1000; NOTE not yet neccesary since the engine call only 2 times to DB, once to retrieve all routes-providers, once to retrieve all booking-providers
const cacheTTL = 0 * 60 * 1000;

/**
 * Fetches all the booking providers from database and caches the result.
 *
 * @return {Array} of providers
 */
function _queryBookingProviders(requests) {

  if (Date.now() < (bookingCacheLastUpdated + cacheTTL)) {
    return Promise.resolve(utils.cloneDeep(cachedBookingProviders));
  }

  // Fetch all booking and routes providers - both of the providers is a small batch, and much quicker than
  // running several SQL queries
  return bookingProviders.getActive()
    .then(providers => {

      bookingCacheLastUpdated = Date.now();
      cachedBookingProviders = providers;
      return utils.cloneDeep(cachedBookingProviders);
    })
    .then(providers => {
      return requests.map(request => {
        return bookingProviders.filter(providers, request);
      });
    });
}

/**
 * Get single booking provider using either providerName or agencyId
 * @param params {Object} contains providerName {String}, agencyId{String}, type{String}, location{Object}
 * @return {Object} provider
 */
function getBookingProvider(param) {
  return _queryBookingProviders([param]);
}

/**
 * Get booking provider in batch mode
 * @param requests {Object / Array}
 * @return providers {Object / Array} typeof response depends on type of requests
 *
 * NOTE If input is object, it should have keys which have value is an array of requests
 * check get-routes/routes.js/_resolveRoutesProviders() for reference
 */
function getBookingProvidersBatch(requests) {
  // Handling of types [{<request data>}, {<request data>}]
  if (requests instanceof Array) {
    // Fetch all providers - it is a small batch, and much quicker than
    // running several SQL queries
    return _queryBookingProviders(requests);
  }

  // Handling of types { key: [<request data>], key2: [: <request data>] }
  if (typeof requests === 'object') {
    const queries = {};
    const keys = Object.keys(requests);

    if (keys.length === 0) {
      return Promise.reject(new Error('Request with no keys given'));
    }

    keys.forEach(key => {
      queries[key] = new Promise((resolve, reject) => {
        return getBookingProvidersBatch(requests[key])
          .then(response => resolve(response))
          .catch(error => reject(error));
      });
    });

    return Promise.props(queries);
  }


  return Promise.reject(new Error('Invalid request, expecting array or object'));
}

module.exports = {
  getBookingProvider,
  getBookingProvidersBatch,
};
