var Promise = require('bluebird');
var request = require('request-promise');
var ec = require('../ec'); // TODO: Error handling based on codes


// var TAXI_API_URL = '';
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
      if(err.statusCode == 500) {
        return 'Taxi API returned 500 -- Internal error occurred';
      }

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