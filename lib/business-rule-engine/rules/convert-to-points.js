'use strict';

const priceConversionRate = require('../lib/priceConversionRate.js');
const Promise = require('bluebird');
const MaasError = require('../../../lib/errors/MaaSError');

// agencyId, price, currency
function convertToPoints(serviceBus, identityId, parameters) {
  return serviceBus.call('MaaS-profile-info', { identityId: identityId }) // TODO decide conversion rate based on user profile / plan
  .then(profile => {
    // check if currency is available
    const currencyAvailable = typeof Object.keys(priceConversionRate).find(currency => currency === parameters.currency) === typeof undefined;

    if (!currencyAvailable) {
      return Promise.reject(new MaasError('Booking currency not supported', 500));
    }

    const priceInPoint = parameters.price * priceConversionRate[parameters.currency];
    return Promise.resolve(priceInPoint);
  });
}

module.exports = {
  convertToPoints,
};
