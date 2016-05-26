var Promise = require('bluebird');
var request = require('request-promise-lite');
var util = require('util');

var ENDPOINT_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

function getCityAddress(Address) {
  var tempAddress = [];
  tempAddress = Address.split(',');
  return tempAddress[tempAddress.length - 2];
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
    key: process.env.GOOGLE_API_KEY,
    latlng: input.lat + ',' + input.lon,
  };
  switch (input.hint) {
    case 'latlon':
      query.result_type = 'street_address';
      break;
    case 'none':
      return Promise.reject(new Error("'none' not supported for Google Geocoding."));
    default:
      throw new Error('Location hint not given');
  }
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
    return callback(err);
  });
};
