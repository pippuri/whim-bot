var Promise = require('bluebird');
var request = require('request-promise-lite');
var ec = require('../lib/ec'); // TODO: Error handling based on codes

function orderTaxi(order) {

  return request.post(ec.TAXI_API_URL + '/order/', {
      pfx: ec.PFX,
      passphrase: ec.PASSPHRASE,
      resolveWithFullResponse: true,
      body: order,
      json: true,
    })
    .then(function (response) {
      if (response.statusCode === 202) { // Order accepted
        return {
          success: true,
          order_id: response.body.id,
        };
      }

      return Promise.resolve(response);
    })
    .catch(function (err) {

      // Some parameters do not match, response payload is different
      if (err.statusCode === 400) {
        return {
          success: false,
          errors: err.response.body.errors,
        };
      } else {
        return {
          success: false,
          code: err.statusCode,
          cause: err.response.body.localized_description,
        };
      }
    });

}

module.exports.respond = function (event, callback) {
  orderTaxi(event)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      callback(err);
    });
};
