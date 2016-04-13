var Promise = require('bluebird');
var request = require('request-promise');
var ec = require('../ec'); // TODO: Error handling based on codes


var TAXI_API_URL = '';

function cancelOrder(orderId) {

  request.delete(TAXI_API_URL + '/order/' + orderId + '/cancel')
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
  cancelOrder(event.id)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      callback(err);
    });
};