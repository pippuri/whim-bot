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
      Authorization: 'Basic ' + new Buffer(PRODUCT_API_KEY).toString('base64')
    }
  });
}

function getStoreComponents() {
  return request.get(PRODUCT_BASE_URL + ADDONS_ENDPOINT, {
    json: true,
    headers: {
      Authorization: 'Basic ' + new Buffer(PRODUCT_API_KEY).toString('base64')
    }
  });
}
module.exports.respond = function (event, callback) {
  Promise.all([getStoreProducts(), getStoreComponents()])
  .then(function (response, resp) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
