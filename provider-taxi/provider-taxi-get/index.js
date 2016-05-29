var Promise = require('bluebird');
var request = require('request-promise-lite');
var ec = require('../lib/ec');

function getOrder(orderId) {

  return request.get(ec.TAXI_API_URL + '/orders/' + orderId, {
    pfx: ec.PFX,
    passphrase: ec.PASSPHRASE,
    rejectUnauthorized: false, // FIXME: Figure out issue and remove line -- RequestError: Error: unable to verify the first certificate
    resolveWithFullResponse: true,
    json: true,
  })
    .then(function (response) {
      return {
        response: response.body.statuses,
      };
    })
    .catch(function (err) {
      return Promise.reject(err);
    });

}

module.exports.respond = function (event, callback) {
  getOrder(event.id)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      console.log('This event caused error: ' + event);
      callback(err);
    });
};
