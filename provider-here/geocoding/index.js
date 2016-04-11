/**
 * GeoJSON format compatible implementation of places, using HERE places API.
 * Sample:
 * {
 * "type": "Feature",
 * "geometry": {
 *   "type": "Point",
 *   "coordinates": [125.6, 10.1]
 * },
 * "properties": {
 *   "name": "Dinagat Islands"
 * }
 * }
 *
 * @see https://developer.here.com/rest-apis/documentation/places/topics_api/resource-search.html
 * @see https://en.wikipedia.org/wiki/GeoJSON 
 */

var Promise = require('bluebird');
var request = require('request-promise');
var util = require('util');

var ENDPOINT_URL = 'https://places.cit.api.here.com/places/v1/discover/search';

function adapt(input) {
  // Customise query by the hints given
  var query = {
      app_id: process.env.HERE_APP_ID,
      app_code: process.env.HERE_APP_CODE,
      q: input.name,
      size: input.count
  };

  switch(input.hint) {
    case 'latlon':
      query.at = [ input.lat, input.lon ].join(',');
      break;
    case 'country':
      // Not implemented
      Promise.reject(new Error("Country hint not implemented."));
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
  .then(function (features) {
    return {
      features: features,
      query: query
    };
  });
}

function parseResults(response) {
  var result = {
    type: 'FeatureCollection',
    features: []
  };
  var items = response.results.items;

  if (!util.isArray(items)) {
    var error = new Error('Invalid response from HERE - invalid format.');
    return Promise.reject(error);
  }

  items.forEach(function(item) {
    var feature = {
      type: 'Feature',
      properties: {
        name: item.title
      },
      geometry: {
        type: 'Point',
        coordinates: [52.5031395, 13.3906403]
      }
    };

    result.features.push(feature);
  });

  return Promise.resolve(result);
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
