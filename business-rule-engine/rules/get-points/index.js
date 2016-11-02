'use strict';

/**
 * NOTE Currently we have only 1 Chargebee addon to do the exchange which used EUR as the base exchange rate
 *
 * This rule is used to convert real money amount to Whim point using different currency exchange rate
 * Different currency exchange rate are translated into different Chargebee addons
 * get-points rule have only
 *      - Batch conversion method
 * Input parameters
 *      - prices {String} - Prices contains {price} amount and {currency}
 */

const Promise = require('bluebird');
const subscriptionManager = require('../../../lib/subscription-manager');
const BusinessRuleError = require('../../BusinessRuleError');

const pricingCache = {};

// Supported currency
const CHARGEBEE_ADDONS = {
  EUR: 'fi-whim-points-purchase-payg',
  // USD: 'fi-whim-points-purchase-payg',
  // GBP: 'fi-whim-points-purchase-payg',
  // NOK: 'fi-whim-points-purchase-payg',
  // SEK: 'fi-whim-points-purchase-payg',
  // RUB: 'fi-whim-points-purchase-payg',
};

/**
 * Get the price based on currency
 * @param  {String} currency
 * @return {Float} point pricing for that currency
 *
 * NOTE Use EUR now if currency is not in CHARGEBEE_ADDONS list
 */
function getPointPricing(identityId, params) {
  if (!CHARGEBEE_ADDONS.hasOwnProperty(params.currency)) {
    return Promise.reject(new BusinessRuleError(`Currency '${params.currency}' is unsupported`, 400, 'get-points'));
  }

  if (pricingCache.hasOwnProperty(params.currency)) {
    return Promise.resolve(pricingCache[params.currency]);
  }

  return subscriptionManager.getAddonById(CHARGEBEE_ADDONS[params.currency])
  .then(response => {
    const addon = response.addon;
    if (!addon) {
      return Promise.reject(new BusinessRuleError(`Failed to retrieve Chargebee point pricing for ${params.currency}`, 500, 'get-point-pricing'));
    }

    // Chargebee returns the prices in cents
    // FIXME The 159 conversion is for SIXT cars - this breaks point pricing symmetry!!
    // FIXME Rename this. This is not a price per point, but inverse of it
    const price = addon.price / 100;
    if (isNaN(price)) {
      return Promise.reject(new BusinessRuleError(`Chargebee response pricing for ${params.currency} is NaN`, 500, 'get-point-pricing'));
    }

    if (price <= 0) {
      return Promise.reject(new BusinessRuleError(`Got a zero/negative unit pricing from Chargebee while getting point price for ${params.currency}`, 500, 'get-point-pricing'));
    }

    pricingCache[params.currency] = price;
    return Promise.resolve(price)
      .catch(error => Promise.reject(new BusinessRuleError(`Cannot run get-point rule, error: ${error.message}`, 500, 'get-point-pricing')));
  });
}

/**
 * Batch convert point from input price amount and currency
 * @param {Object} params - input parameters - contains prices {Array} which is list of price {Object} contains amount and currency
 * {
 *  prices: [
 *    {
 *      amount: 123,
 *      currency: 'EUR'
 *    },
 *    {
 *      amount: 456,
 *      currency: 'EUR'
 *    }
 *  ]
 * }
 *
 * @return convertedPrices {Array} Array of point pricing
 */
function getPointBatch(identityId, params) {
  if (!params.hasOwnProperty('prices') || !(params.prices instanceof Array) || !(params.prices.length > 0)) {
    // TODO Move into validation code
    return Promise.reject(new BusinessRuleError('Expected params.prices to be an array of prices, got ' + JSON.stringify(params.prices, null, 2), 500, 'get-point-pricing-batch'));
  }

  const conversionQueue = params.prices.map((price, index) => {
    // Fallback if currency !== currency of the first item
    if (price.currency !== params.prices[index].currency) {
      // TODO Move into validation code
      throw new BusinessRuleError('Business engine doesnt suppport mixed currency requests at the moment', 500, 'get-point-pricing-batch');
    }

    return getPointPricing(identityId, { currency: price.currency })
      // Points should always be integers; round up to the nearest point
      .then(unitPrice => Math.ceil(price.amount / unitPrice));
  });

  return Promise.all(conversionQueue);
}

module.exports = {
  getPointPricing,
  getPointBatch,
};
