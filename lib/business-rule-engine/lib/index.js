'use strict';

const _ = require('lodash');

const pricelistDatabase = require('./pricelistDatabase');

function getUserSpecificPrices(profile) {

  // TODO make basePricelistIds configurable

  const basePricelistIds = ['pricelist0'];

  // TODO read userSpecificPricelistIds from profile

  const userSpecificPricelistIds = ['pricelist2'];

  const applicablePricelistIds = basePricelistIds.concat(userSpecificPricelistIds);
  const prices = _.flatten(applicablePricelistIds.map(pricelistId => pricelistDatabase[pricelistId].prices));
  return prices;
}

module.exports = {
  getUserSpecificPrices,
};
