var Promise = require('bluebird');
var request = require('request-promise');
var ec = require('../lib/ec'); // TODO: Error handling based on codes

function orderTaxi(order) {

  return request.post(ec.TAXI_API_URL + '/order/', {
    pfx: ec.PFX,
    passphrase: ec.PASSPHRASE,
    rejectUnauthorized: false, // FIXME: Figure out issue and remove line -- RequestError: Error: unable to verify the first certificate
    resolveWithFullResponse: true,
    body: order,
    json: true
  })
    .then(function (response) {
      if(response.statusCode == 202) { // Order accepted
        return {
          success: true,
          order_id: response.body.id
        };
      }
      
      return Promise.resolve(response);
    })
    .catch(function (err) {
      if(err.statusCode == 400) { // Some parameters do not match, response payload is different
        return {
          success: false,
          errors: err.error.errors
        }
      } else {
        return {
          success: false,
          code: err.error.code,
          cause: err.error.localized_description
        }
      }
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