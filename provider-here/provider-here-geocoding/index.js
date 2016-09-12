'use strict';

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

const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');

const ENDPOINT_URL = 'https://places.cit.api.here.com/places/v1/discover/search';

function parseResults(response) {
  const result = {
    type: 'FeatureCollection',
    features: [],
  };
  const items = response.results.items;
  const context = response.search.context;

  if (!util.isArray(items)) {
    const error = new Error('Invalid response from HERE - invalid format.');
    return Promise.reject(error);
  }

  items.forEach(item => {
    const address = context.location.address;

    const feature = {
      type: 'Feature',
      properties: {
        name: item.title,
        country: address.country,
        countryCode: address.countryCode,
        city: address.city,
        zipCode: address.postalCode,
        streetName: item.vicinity && item.vicinity.split('<br/>')[0],
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
    size: input.count,
    at: [input.lat, input.lon].join(','),
  };

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
    callback(new Error('Missing HERE_APP_ID'));
  } else if (typeof process.env.HERE_APP_CODE === typeof undefined) {
    callback(new Error('Missing HERE_APP_CODE'));
  } else {
    adapt(event)
    .then(response => {
      return callback(null, response);
    })
    .catch(err => {
      console.info('This event caused error: ' + JSON.stringify(event, null, 2));
      return callback(err);
    });
  }
};
