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

// TODO Move dataset to another place
const zipcodeDataset = require('../../zipcode-Uusimaa.json');

/**
 * Give profile free service from agencyId if included in profile subscription.
 * Region context based on City registered on client
 * TODO many thing, these logic checks are not enough
 */
function getProfileSpecificPricing(providers, profile) {
  const clone = utils.cloneDeep(providers);

  if (providers instanceof Array) {
    clone.forEach(provider => {
      if (profile.subscription.agencies.some(agency => {
        return agency === provider.agencyId && // Agency is included in plan
              profile.zipCode && profile.city && // Profile have zipcode and city data
              zipcodeDataset[profile.zipCode] && // Zipcode is in Uusimaa
              provider.region.toLowerCase().indexOf(zipcodeDataset['' + profile.zipCode].city.toLowerCase()) >= 0 && // Provider region contain profile city data
              provider.providerPrio === 1; // Give free ticket only to single region
      })) {
        provider.value = 0;
        provider.baseValue = 0;
      }
    });

    return clone;
  }

  if (profile.subscription.agencies.some(agency => {
    return agency === clone.agencyId && // Agency is included in plan
            profile.zipCode && profile.city && // Profile have zipcode and city data
            zipcodeDataset[profile.zipCode] && // Zipcode is in Uusimaa
            clone.region.toLowerCase().indexOf(zipcodeDataset['' + profile.zipCode].city.toLowerCase()) >= 0 && // Provider region contain profile city data
            clone.providerPrio === 1; // Give free ticket only to single region
  })) {
    clone.value = 0;
    clone.baseValue = 0;
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

  if (!params.agencyId) {
    throw new Error('No agencyId supplied to the engine');
  }

  const query = {
    agencyId: params.agencyId,
    from: params.from,
  };
  return getProviderRules.getBookingProvider(query)
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

    if (!request.agencyId) {
      throw new Error(`The request does not supply 'agencyId' to the TSP engine: ${JSON.stringify(request)}`);
    }

    return {
      agencyId: request.agencyId,
      from: request.from,
    };
  });

  return getProviderRules.getBookingProvidersBatch(queries)
    .then(providers => {
      return providers.map((providers, index) => {
        // Always pick the first provider - they are in priority order
        if (providers.length < 1) {
          console.warn(`Could not find pricing provider for ${JSON.stringify(queries[index])}`);
          return null;
        }
        return getProfileSpecificPricing(providers, profile);
      })
      .filter(provider => typeof provider !== typeof undefined);
    });
}

module.exports = {
  getOptions,
  getOptionsBatch,
};
