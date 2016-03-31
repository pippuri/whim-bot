var Promise = require('bluebird');
var request = require('request-promise');
var util = require('util');

var ENDPOINT_URL = 'https://places.demo.api.here.com/places/v1/suggest';

function adapt(input) {
  // Customise query by the hints given
  var query = {
      app_id: process.env.HERE_APP_ID,
      app_code: process.env.HERE_APP_CODE,
      q: input.name
  };

  switch(input.hint) {
    case 'latlon': 
      query.at = [ input.lat, input.lon ].join(',')
      break;
    case 'none':
      break;
    default:
      throw new Error('Location hint not given');
  }

  return request.get(ENDPOINT_URL, {
    json: true,
    headers: {},
    qs: query
  })
  .then(parseResults)
  .then(slice(input.count))
  .then(function (suggestions) {
    return {
      suggestions: suggestions,
      query: query
    };
  });
}

function parseResults(response) {
  var suggestions = response.suggestions;

  if (!util.isArray(suggestions)) {
    var error = new Error('Invalid response from HERE - invalid format.');
    return Promise.reject(error);
  }

  return Promise.resolve(suggestions);
}

/**
 * Return the N first items
 */
function slice(numItems) {
  return function(locations) {
    return Promise.resolve(locations.slice(0, numItems));
  };
}

module.exports.respond = function (event, callback) {
  adapt(event)
  .then(function(response) {
    callback(null, response);
  })
  .catch(function(err) {
    callback(err);
  });
};
