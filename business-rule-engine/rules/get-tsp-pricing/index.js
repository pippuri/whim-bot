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

/**
 * Check if user's plan includes provider as a feature
 * @param plans {Object}
 * @param provider {Object}
 *
 * @return {Boolean} return truthy value if is, and vice versa
 */
function _userPlanIncludesProvider(plans, provider) {
  if (provider && provider.agencyId) {
    return plans.some(plan => {
      if (!plan.feature || plan.feature.length === 0) return false;
      return plan.feature.some(feature => {
        return feature.name.toUpperCase() === provider.agencyId.toUpperCase();
      });
    });
  }

  return false;
}

/**
 * Populate pricing information based on context
 */
function _setPricing(provider, userProfile) {
  if (!provider) {
    throw new Error('No provider found, cannot set price');
  }

  const planLevel = userProfile.planlevel;
  if (planLevel === 0) {
    // TODO for PAYG, add a small margin for everything
    provider.providerMeta.value = provider.providerMeta.value + 0;
  } else if (planLevel > 0) {
    if (_userPlanIncludesProvider(userProfile.plans, provider)) {
      provider.providerMeta.value = 0;
      provider.providerMeta.baseValue = 0;
    }
  } else {
    // TODO Should be solved in validation code
    throw new Error(`Invalid planlevel from Chargebee: '${planLevel}'`);
  }

  return provider;
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
    throw new Error('No \'from\' supplied to the TSP engine');
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
      return _setPricing(providers[0], profile);
    });
}

// TODO Why do we only use from, but not to?
function getOptionsBatch(params, profile) {
  const queries = params.map(request => {
    if (!request.hasOwnProperty('from')) {
      throw new Error(`The request does not supply 'from' to the TSP engine: ${JSON.stringify(request)}`);
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

        return _setPricing(providers[0], profile);
      })
      .filter(provider => typeof provider !== typeof undefined);
    });
}

module.exports = {
  getOptions,
  getOptionsBatch,
};
