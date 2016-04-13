var Promise = require('bluebird');
var request = require('request-promise');
var ec = require('../ec'); // TODO: Error handling based on codes


var TAXI_API_URL = '';

function validateOrder(order) {

  request.post(TAXI_API_URL + '/order-validate', {
      body: order,
      json: true
    })
    .then(function (response) {
      console.log(response);
      return Promise.resolve(response);
    })
    .catch(function (err) {
      console.log(JSON.stringify(err));
      return Promise.reject(err);
    })

}

module.exports.respond = function(event, callback) {
  validateOrder(event.id)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      callback(err);
    });
};