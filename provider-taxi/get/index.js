var Promise = require('bluebird');
var request = require('request-promise');
var ec = require('../ec'); // TODO: Error handling based on codes


var TAXI_API_URL = '';

function getOrder(orderId) {

  request.get(TAXI_API_URL + '/orders/' + orderId, {
    resolveWithFullResponse: true,
    json: true
  })
    .then(function (response) {
      console.log(response);

      if(!(/^2[0-9]{2}$/.test('' + response.statusCode))) {
        // Not a 2xx response. Problems.
        console.log("HTTP failed response -- code", response.statusCode);
        console.log(JSON.stringify(response));

        return Promise.reject(response);
      } else {
        console.log("All good -- code", response.statusCode);
        console.log(JSON.stringify(response));

        return Promise.resolve(response);
      }
    })
    .catch(function (err) {
      console.log(JSON.stringify(err));
      return Promise.reject(err);
    })

}

module.exports.respond = function(event, callback) {
  getOrder(event.id)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      callback(err);
    });
};