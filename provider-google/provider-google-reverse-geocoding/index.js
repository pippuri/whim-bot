var Promise = require('bluebird');
var request = require('request-promise-lite');
var util = require('util');

var ENDPOINT_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

function getCityAddress(Address) {
  var tempAddress = [];
  tempAddress = Address.split(',');
  return ((tempAddress[tempAddress.length - 2]).replace(/\d+/g, '')).trim();
}

function parseResults(response) {
  var result = {
    type: 'FeatureCollection',
    features: [],
  };

  var items = response;
  if (!util.isArray(items.results)) {
    var error = new Error('Invalid response from Google - invalid format.');
    return Promise.reject(error);
  }

  items.results.forEach(function (item) {
    var feature = {
      type: 'Feature',
      properties: {
        name: item.formatted_address,
        city: getCityAddress(item.formatted_address),
      },
      geometry: {
        type: 'Point',
        coordinates: [item.geometry.location.lat, item.geometry.location.lng],
      },
    };
    result.features.push(feature);
  });

  return Promise.resolve(result);
}

function adapt(input) {
  var query = {
    key: 'AIzaSyDoItUq6y7LTrZLQy-t7aXbfajgdBgRyco',
    latlng: input.lat + ',' + input.lon,
  };
  query.result_type = 'street_address';
  return request.get(ENDPOINT_URL, {
    json: true,
    headers: {},
    qs: query,
  })
  .then(parseResults)
  .then(function (response) {
    response.query = query;
    return response;
  });
}

module.exports.respond = function (event, callback) {
  adapt(event)
  .then(function (response) {
    return callback(null, response);
  })
  .catch(function (err) {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    return callback(err);
  });
};
