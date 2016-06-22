'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');

const ENDPOINT_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

function parseResults(response) {
  const result = {
    type: 'FeatureCollection',
    features: [],
  };
  const items = response;
  if (!util.isArray(items.results)) {
    const error = new Error('Invalid response from Google - invalid format.');
    return Promise.reject(error);
  }

  items.results.forEach(item => {
    const feature = {
      type: 'Feature',
      properties: {
        name: item.formatted_address,
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
  // Customise query by the hints given
  const query = {
    key: process.env.GOOGLE_API_KEY,
    address: input.name,
  };

  switch (input.hint) {
    case 'latlon':
      query.component = 'country:' + input.country;
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
  .then(response => {
    // Inject query to the response
    // Note: This is a bit unsafe, since we're actually modifying
    // the call parameter. Should be ok in this case, though.
    response.query = query;
    return response;
  });
}

module.exports.respond = function (event, callback) {
  adapt(event)
  .then(response => {
    return callback(null, response);
  })
  .catch(err => {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    return callback(err);
  });
};
