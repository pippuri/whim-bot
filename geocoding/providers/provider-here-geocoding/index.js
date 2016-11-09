'use strict';

/**
 * GeoJSON format compatible implementation of places, using HERE places API.
 * Note: This API disregards the locale information (it is not supported).
 *
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

const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');
const MaaSError = require('../../../lib/errors/MaaSError.js');

const ENDPOINT_URL = 'https://places.cit.api.here.com/places/v1/discover/search';
const SEARCH_COUNT = 10;   // Find a maximum of 10 results by default

function parseResults(response) {
  const result = {
    type: 'FeatureCollection',
    features: [],
  };
  const items = response.results.items;

  if (!util.isArray(items)) {
    const error = new MaaSError('Invalid response from HERE - invalid format.', 500);
    return Promise.reject(error);
  }

  items.forEach(item => {
    const feature = {
      type: 'Feature',
      properties: {
        name: item.title,
      },
      geometry: {
        type: 'Point',
        coordinates: item.position,
      },
    };

    result.features.push(feature);
  });

  return Promise.resolve(result);
}

function adapt(input) {

  // Customise query by the hints given
  const query = {
    app_id: process.env.HERE_APP_ID,
    app_code: process.env.HERE_APP_CODE,
    q: input.name,
    size: input.count || SEARCH_COUNT,
    tf: 'plain',
  };
  // Use different query format if radius is given
  if (input.radius) {
    query.in = `${input.lat},${input.lon};r=${input.radius}`;
  } else {
    query.at = `${input.lat},${input.lon}`;
  }

  return request.get(ENDPOINT_URL, {
    json: true,
    headers: {},
    qs: query,
  })
  .then(parseResults)
  .then(response => {
    // Inject query to the response
    // Note: This is a bit unsafe, since we're actually modifying
    // the call parameter. Should be ok in this case, though.
    response.debug = query;
    return response;
  });
}

module.exports.respond = function (event, callback) {
  if (typeof process.env.HERE_APP_ID === typeof undefined) {
    callback(new MaaSError('Missing HERE_APP_ID', 500));
  } else if (typeof process.env.HERE_APP_CODE === typeof undefined) {
    callback(new MaaSError('Missing HERE_APP_CODE', 500));
  } else {
    adapt(event)
    .then(response => (callback(null, response)))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      // Uncaught, unexpected error
      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
  }
};
