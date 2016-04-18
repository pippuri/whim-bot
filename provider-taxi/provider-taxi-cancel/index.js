var Promise = require('bluebird');
var request = require('request-promise');
var ec = require('../lib/ec'); // TODO: Error handling based on codes


// var TAXI_API_URL = '';
var TAXI_API_URL = 'http://api.infotripla.fi/InfotriplaMaasWebService/maas/taxiapi/taiste/cancelorder/';

function cancelOrder(orderId) {

  return request.del(TAXI_API_URL + orderId, {
      auth: {
        user: 'taisteTaxiApiUser105',
        pass: 'Kaithah5'
      }
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
  cancelOrder(event.id)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      callback(err);
    });
};