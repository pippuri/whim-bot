var Promise = require('bluebird');
var request = require('request-promise');
var ec = require('../ec'); // TODO: Error handling based on codes


var TAXI_API_URL = '';

function orderTaxi(order) {

  request.post(TAXI_API_URL + '/order', {
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
  orderTaxi(event)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      callback(err);
    });
};