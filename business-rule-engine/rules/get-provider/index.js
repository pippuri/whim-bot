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
const _ = require('lodash');

const models = require('../../../lib/models/index');
const Provider = models.Provider;

/**
 * Get single provider data by providerName
 * @param providerName {String}
 */
function _getProviderByName(providerName) {
  if (!providerName || typeof providerName !== 'string') {
    // TODO Move into validation code
    return Promise.reject(new Error('Invalid of no providerName in params'));
  }

  return Provider.query()
    .select('providerName', 'providerType', 'providerPrio', 'providerMeta')
    .where('providerName', providerName)
    .orderBy('providerPrio');
}

/**
 * Get single provider using either providerName or agencyId
 * @param params {Object} contains providerName {String}, agencyId{String}, type{String}, location{Object}
 * @return {Object} provider
 */
function getProvider(params) {
  // Get provider by providerName
  if (params.hasOwnProperty('providerName')) return _getProviderByName(params.providerName);

  // TODO Move into validation code
  if (!params.type) return Promise.reject(new Error('Provider type undefined'));

  if (!params.hasOwnProperty('agencyId')) {
    if (!params.hasOwnProperty('location')) {
      return Promise.reject(new Error(`No location in params ${params}`));
    }

    if (!params.location.hasOwnProperty('lat') || !params.location.hasOwnProperty('lon')) {
      // TODO Move into validation code
      return Promise.reject(new Error(`No location components in params ${params}`));
    }
  }

  const location = {
    lat: params.location ? params.location.lat || 0 : 0,
    lon: params.location ? params.location.lon || 0 : 0,
  };

  params = {
    location: location,
    type: params.type,
    agencyId: params.agencyId ? params.agencyId : undefined,
  };
  return Provider.selectProvider(params.type, params)
    .then(response => Promise.resolve(response.rows))
    .catch(error => Promise.reject(new Error(`Cannot run get-provider rule, error: ${error.message}`)));
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
  if (requests instanceof Array) {
    const queue = [];
    requests.forEach(request => {
      const query = Provider.selectProvider(request.type, request);
      queue.push(query);
    });

    // .. and execute them
    return Promise.all(queue)
      .then(results => Promise.resolve(results.map(result => result.rows)))
      .catch(error => Promise.reject(new Error(`Cannot run get-provider-batch rule, error: ${error.message}`)));
  }

  if (typeof requests === 'object') {
    const queue = [];

    // If 'requests' is an object, queue will be a 2 level Array
    Object.keys(requests).forEach((key, index) => {
      queue[index] = [];
      requests[key].forEach(request => {
        const query = Provider.selectProvider(request.type, request);
        queue[index].push(query);
      });
    });

    // Populate placeholder response object with same key as requests
    const response = Object.assign(requests);
    Object.keys(response).forEach(key => {
      response[key] = [];
    });

    // Save the length of each object key here to regenerate back to pre-flatten
    const objectKeyLength = queue.map(item => {
      return item.length;
    });

    return Promise.all(_.flatten(queue))
      .then(results => {
        const resultRows = results.map(result => result.rows);

        let count = 0;
        let currentKeyIndex = 0;
        resultRows.forEach(row => {
          if (objectKeyLength[currentKeyIndex] === 0) {
            currentKeyIndex++;
            response[Object.keys(response)[currentKeyIndex]].push(row);
          } else if (count < objectKeyLength[currentKeyIndex] - 1 ) {
            response[Object.keys(response)[currentKeyIndex]].push(row);
            count++;

          } else if (count < objectKeyLength[currentKeyIndex]) {
            response[Object.keys(response)[currentKeyIndex]].push(row);
            currentKeyIndex++;
            count = 0;
          }
        });
        return Promise.resolve(response);
      })
      .catch(error => Promise.reject(new Error(`Cannot run get-provider-batch rule, error: ${error.message}`)));
  }

  // We should never get there - the error should have been caught in validation earlier
  return Promise.reject(new Error('Batch provider should have input as object or array'));
}

module.exports = {
  getProvider,
  getProviderBatch,
};
