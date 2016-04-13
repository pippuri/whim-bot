var Promise = require('bluebird');
var request = require('request-promise');
var util = require('util');

var ENDPOINT_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';

function parseResults(response) {
  var suggestions;

  if (!util.isArray(response.predictions)) {
    var error = new Error('Invalid response from Google - invalid format.');
    return Promise.reject(error);
  }

  suggestions = response.predictions.map(function (item) {
    return item.description;
  });

  return Promise.resolve(suggestions);
}

/**
 * Return the N first items
 */
function slice(numItems) {
  return function (locations) {
    return Promise.resolve(locations.slice(0, numItems));
  };
}

function adapt(input) {
  // Customise query by the hints given
  var query = {
    key: process.env.GOOGLE_API_KEY,
    input: input.name,
    types: 'geocode',
  };

  switch (input.hint) {
    case 'latlon':
      query.location = [input.lat, input.lon].join(',');
      radius = input.radius * 1000;
      break;
    case 'none':
      break;
    default:
      throw new Error('Location hint not given');
  }

  return request.get(ENDPOINT_URL, {
    json: true,
    headers: {},
    qs: query,
  })
  .then(parseResults)
  .then(slice(input.count))
  .then(function (suggestions) {
    return {
      suggestions: suggestions,
      query: query,
    };
  });
}

module.exports.respond = function (event, callback) {
  adapt(event)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
