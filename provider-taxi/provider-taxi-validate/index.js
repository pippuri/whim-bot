var Promise = require('bluebird');
var request = require('request-promise');

var ec = require('../lib/ec'); // TODO: Error handling based on codes


// var TAXI_API_URL = 'https://maas.valopilkkupalvelu.fi';
var TAXI_API_URL = 'http://api.infotripla.fi/InfotriplaMaasWebService/maas/taxiapi/taiste/validateorder/';

function validateOrder(order) {

  return request.post(TAXI_API_URL, {
      body: order,
      json: true,
      auth: {
        user: 'taisteTaxiApiUser105',
        pass: 'Kaithah5'
      }
    }) 
    .then(function (response) {
      console.log("Got response");
      console.log(response);
      return response;
    })
    .catch(function (err) {
      console.log("Got error");
      console.log(JSON.stringify(err));
      console.log(JSON.stringify(err.message));

      return Promise.reject(err);
    })

}

module.exports.respond = function(event, callback) {
  validateOrder(event.id)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      callback(err);
    });
};