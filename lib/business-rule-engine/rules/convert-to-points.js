'use strict';

const priceConversionRate = require('../lib/priceConversionRate.js');
const MaasError = require('../../../lib/errors/MaaSError');

// agencyId, price, currency
function convertToPoints(serviceBus, identityId, parameters) {
    // check if currency is available
  const currencyUnavailable = typeof Object.keys(priceConversionRate).find(currency => currency === parameters.currency) === typeof undefined;

  if (currencyUnavailable) {
    throw new MaasError(`Booking currency ${parameters.currency} not supported`, 500);
  }

  const priceInPoint = parameters.price * priceConversionRate[parameters.currency];
  return Math.round(priceInPoint * 100) / 100; // 2 decimals
}

module.exports = {
  convertToPoints,
};
