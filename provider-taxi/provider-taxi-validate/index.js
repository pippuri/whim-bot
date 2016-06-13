'use strict';

const request = require('request-promise-lite');
const ec = require('../lib/ec'); // TODO: Error handling based on codes

function validateOrder(order) {

  return request.post(ec.TAXI_API_URL + '/order/validate/', {
      pfx: ec.PFX,
      passphrase: ec.PASSPHRASE,
      rejectUnauthorized: false, // FIXME: Figure out issue and remove line -- RequestError: Error: unable to verify the first certificate
      resolveWithFullResponse: true,
      body: order,
      json: true,
    })
    .then(function (response) {
      if (response.statusCode === 200) {
        return {
          validated: true,
        };
      }

      return response;
    })
    .catch(function (err) {
      return {
        validated: false,
        code: err.response.body.code,
        cause: err.response.body.localized_description,
      };
    });

}

module.exports.respond = function (event, callback) {
  validateOrder(event)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(err);
    });
};
