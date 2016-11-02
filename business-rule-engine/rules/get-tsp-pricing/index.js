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

const getProviderRules = require('../get-provider');
const utils = require('../../../lib/utils');
const BusinessRuleError = require('../../BusinessRuleError.js');

/**
 * Combine pricing based on provider and profile information
 */
function getProfileSpecificPricing(provider, profile) {
  const clone = utils.cloneDeep(provider);
  const agencyId = provider.providerMeta.agencyId;

  // If agency is included in the plan, skip costs
  if (profile.subscription.agencies.some(a => a === agencyId)) {
    clone.providerMeta.value = 0;
    clone.providerMeta.baseValue = 0;
  }

  return clone;
}

/**
 * Get the geographically relevant TSP along with pricing information
 * TODO make this use the new TSP API to query for options in real time
 * and provide customized results to a given user
 * @param  {Object} event
 * @return {Object} TSP pricing structure
 */
function getOptions(params, profile) {
  if (!params.hasOwnProperty('from') || Object.keys(params.from).length === 0) {
    // TODO Should be handled by validator, instead
    throw new BusinessRuleError('No \'from\' supplied to the TSP engine', 400, 'get-routes');
  }

  const query = {
    type: 'tsp-booking-' + params.type.toLowerCase(),
    from: params.from,
  };
  return getProviderRules.getProvider(query)
    .then(providers => {
      if (providers.length < 1) {
        console.warn(`Could not find pricing provider for ${JSON.stringify(query)}`);
        return null;
      }

      // use only the pricing provider in the order of priority
      return getProfileSpecificPricing(providers[0], profile);
    });
}

// TODO Why do we only use from, but not to?
function getOptionsBatch(params, profile) {
  const queries = params.map(request => {
    if (!request.hasOwnProperty('from')) {
      throw new BusinessRuleError(`The request does not supply 'from' to the TSP engine: ${JSON.stringify(request)}`, 400, 'get-routes');
    }

    if (request.agencyId) {
      return {
        agencyId: request.agencyId,
        location: request.from,
      };
    }

    return {
      type: `tsp-booking-${request.type.toLowerCase()}`,
      location: request.from,
    };
  });

  return getProviderRules.getProviderBatch(queries)
    .then(responses => {
      return responses.map((providers, index) => {
        // Always pick the first provider - they are in priority order
        if (providers.length < 1) {
          console.warn(`Could not find pricing provider for ${JSON.stringify(queries[index])}`);
          return null;
        }

        return getProfileSpecificPricing(providers[0], profile);
      })
      .filter(provider => typeof provider !== typeof undefined);
    });
}

module.exports = {
  getOptions,
  getOptionsBatch,
};
