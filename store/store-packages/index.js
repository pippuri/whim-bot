// Require dependency
var Promise = require('bluebird');
var request = require('request-promise-lite');

var PRODUCT_BASE_URL =  'https://whim-test.chargebee.com/api/v2/';

var PRODUCTS_ENDPOINT = 'plans';
var ADDONS_ENDPOINT = 'addons';

// this key is read-only for products
var PRODUCT_API_KEY = 'test_XS9469U7N9XORirV8Hv6YZVIV6L0y4zx:';

// Get regions from TripGo
function getStoreProducts() {
  return request.get(PRODUCT_BASE_URL + PRODUCTS_ENDPOINT, {
    json: true,
    headers: {
      Authorization: 'Basic ' + new Buffer(PRODUCT_API_KEY).toString('base64'),
    },
  });
}

function getStoreAddons() {
  return request.get(PRODUCT_BASE_URL + ADDONS_ENDPOINT, {
    json: true,
    headers: {
      Authorization: 'Basic ' + new Buffer(PRODUCT_API_KEY).toString('base64'),
    },
  });
}

function formatResponse(input) {

  var plans = [];
  var addons = [];

  // Parse plans
  for (var i = 0; i < input[0].list.length; i++) {
    var context = input[0].list[i].plan;
    console.log('context', context);
    plans.push({
      id: context.id,
      name: context.name,
      invoiceName: context.invoice_name,
      price: context.price,
      currency: context.meta_data.currency,
      formattedPrice: context.meta_data.currency + context.price,
      description: context.meta_data.description,
      pointGrant: context.meta_data.pointGrant,
      period: context.period,
      periodUnit: context.period_unit,
      chargeModel: context.chargeModel,
      feature: context.meta_data.feature,
      provider: context.meta_data.provider,
    });
  }

  // Parse addons
  for (var i = 0; i < input[1].list.length; i++) {
    var context = input[1].list[i].plan;
    console.log('context', context);
    addons.push({
      id: context.id,
      name: context.name,
      invoiceName: context.invoice_name,
      price: context.price,
      period: context.period,
      periodUnit: context.period_unit,
      chargeModel: context.chargeModel,
    });
  }

  return input;
}

module.exports.respond = function (event, callback) {
  Promise.all([getStoreProducts(), getStoreAddons()])
  .then(function (response) {
    callback(null, formatResponse(response));
  })
  .catch(function (error) {
    callback(error);
  });
};
