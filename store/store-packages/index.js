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

  var output = {
    plans: [],
    addons: [],
  };

  // Parse plans
  for (var i = 0; i < input[0].list.length; i++) {
    var planContext = input[0].list[i].plan;

    output.plans.push({
      id: planContext.id,
      name: planContext.name,
      invoiceName: planContext.invoice_name,
      price: planContext.price,
      currency: planContext.meta_data.currency,
      formattedPrice: planContext.meta_data.currency + planContext.price,
      description: planContext.meta_data.description,
      pointGrant: planContext.meta_data.pointGrant,
      period: planContext.period,
      periodUnit: planContext.period_unit,
      chargeModel: planContext.charge_model,
      feature: planContext.meta_data.features,
      provider: planContext.meta_data.provider,
    });
  }

  // Parse addons
  for (var j = 0; j < input[1].list.length; j++) {
    var addonContext = input[1].list[j].addon;

    output.addons.push({
      id: addonContext.id,
      name: addonContext.name,
      invoiceName: addonContext.invoice_name,
      price: addonContext.price,
      period: addonContext.period,
      periodUnit: addonContext.period_unit,
      chargeModel: addonContext.charge_model,
    });
  }

  return output;
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
