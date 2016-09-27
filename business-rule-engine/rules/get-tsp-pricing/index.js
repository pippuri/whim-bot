'use strict';

/**
 * Get the tsp pricing based on which tsp it is
 * Parameters
 *      - type {String}
 *      - method {String}
 *      - startTime {Float}
 *      - endTime {Float}
 *      - location {Object} contains {from} and {to}
 *      - userProfile {Object}
 */

const getProviderRules = require('../get-provider');
const Promise = require('bluebird');

/**
 * Check if user's plan includes provider as a feature
 * @param plans {Object}
 * @param provider {Object}
 *
 * @return {Boolean} return truthy value if is, and vice versa
 */
function _userPlanIncludes(plans, provider) {

  if (!plans) return false;
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
  const userLevel = userProfile.planlevel;
  if (userLevel === 0) {
    // TODO for PAYG, add a small margin for everything
    provider.providerMeta.value = provider.providerMeta.value + 0;
  } else if (userLevel > 0) {
    if (_userPlanIncludes(userProfile.plans, provider)) {
      provider.providerMeta.value = 0;
      provider.providerMeta.baseValue = 0;
    }
  } else {
    // TODO Should be solved in validation code
    throw new Error(`Invalid planlevel from Chargebee: '${userProfile.planlevel}'`);
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
  if (!params.hasOwnProperty('location') || Object.keys(params.location).length === 0) {
    // TODO Should be handled by validator, instead
    throw new Error('No location supplied to TSP engine');
  }

  const query = {
    type: 'tsp-booking-' + params.type.toLowerCase(),
    location: params.location.from,
  };
  return getProviderRules.getProvider(query)
    .then(provider => {
      if (provider.length < 1) return Promise.resolve(provider);
      // use only the first pricing provider in order of priority (should only be one really anyway)
      return _setPricing(provider[0], profile);
    });
}

// NOTE TODO Why does location contains only from but not to?
function getOptionsBatch(params, profile) {

  const queries = params.map(request => {
    if (!request.hasOwnProperty('location') || Object.keys(request.location) === 0) {
      // TODO Should be handled by validator, instead
      throw new Error('One or more request does not supply location to the TSP engine');
    }

    if (request.agencyId) {
      return {
        agencyId: request.agencyId,
        location: request.location.from,
      };
    }

    return {
      type: `tsp-booking-${request.type.toLowerCase()}`,
      location: request.location.from,
    };
  });

  return getProviderRules.getProviderBatch(queries)
    .then(providers => providers.map(provider => _setPricing(provider[0], profile)))
    .catch(error => Promise.reject(error));
}

module.exports = {
  getOptions,
  getOptionsBatch,
};
