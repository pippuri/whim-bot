var Promise = require('bluebird');
var request = require('request-promise');
var ec = require('../lib/ec'); // TODO: Error handling based on codes


// var TAXI_API_URL = '';
var TAXI_API_URL = 'http://api.infotripla.fi/InfotriplaMaasWebService/maas/taxiapi/taiste/createorder/';

function orderTaxi(order) {

  return request.post(TAXI_API_URL, {
    body: order,
    json: true,
    auth: {
      user: 'taisteTaxiApiUser105',
      pass: 'Kaithah5'
    }
  })
    .then(function (response) {
      console.log(response);
      console.log(response.statusCode);

      return Promise.resolve(response);
    })
    .catch(function (err) {
      console.log(JSON.stringify(err));
      console.log(err.statusCode);
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