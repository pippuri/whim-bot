var request = require('request-promise-lite');
var ec = require('../lib/ec'); // TODO: Error handling based on codes

function cancelOrder(orderId) {

  return request.del(ec.TAXI_API_URL + '/order/' + orderId + '/cancel/', {
    pfx: ec.PFX,
    passphrase: ec.PASSPHRASE,
    rejectUnauthorized: false, // FIXME: Figure out issue and remove line -- RequestError: Error: unable to verify the first certificate
    resolveWithFullResponse: true,
    json: true,
  })
    .then(function (response) {
      return {
        cancelled: true,
      };
    })
    .catch(function (err) {
      return {
        cancelled: false,
        code: err.response.body.code,
        cause: err.response.body.localized_description,
      };
    });

}

module.exports.respond = function (event, callback) {
  cancelOrder(event.id)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      callback(err);
    });
};
