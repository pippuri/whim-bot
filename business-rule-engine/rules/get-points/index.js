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
const bus = require('../../../lib/service-bus');
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
    return Promise.reject(new BusinessRuleError(`Currency '${params.currency}' is unsupported`, 'get-points'));
  }

  if (pricingCache.hasOwnProperty(params.currency)) {
    return Promise.resolve(pricingCache[params.currency]);
  }

  return bus.call('MaaS-store-single-package', {
    type: 'addon',
    id: CHARGEBEE_ADDONS[params.currency],
  })
  .then(addon => {
    if (!addon.price) {
      return Promise.reject(new Error(`Failed to retrieve Chargebee point pricing for ${params.currency}`));
    }

    if (isNaN(addon.price)) {
      return Promise.reject(new Error(`Chargebee response pricing for ${params.currency} is NaN`, 500));
    }

    if (addon.price <= 0) {
      return Promise.reject(new Error(`Got a zero/negative unit pricing from Chargebee while getting point price for ${params.currency}`, 500));
    }

    pricingCache[params.currency] = addon.price;
    return Promise.resolve(addon.price)
      .catch(error => Promise.reject(new Error(`Cannot run get-point rule, error: ${error.message}`)));
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
    return Promise.reject(new Error('Expected params.prices to be an array of prices, got ' + JSON.stringify(params.prices, null, 2)));
  }

  const conversionQueue = params.prices.map((price, index) => {
    // Fallback if currency !== currency of the first item
    if (price.currency !== params.prices[index].currency) {
      // TODO Move into validation code
      throw new Error('Business engine doesnt suppport mixed currency requests at the moment');
    }

    return getPointPricing(identityId, { currency: price.currency })
      .then(unitPrice => Math.round((price.amount / unitPrice) * 100) / 100);
  });

  return Promise.all(conversionQueue);
}

module.exports = {
  getPointPricing,
  getPointBatch,
};
