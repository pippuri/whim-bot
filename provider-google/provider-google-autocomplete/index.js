'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');

const ENDPOINT_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';

function parseResults(response) {

  if (!util.isArray(response.predictions)) {
    const error = new Error('Invalid response from Google - invalid format.');
    return Promise.reject(error);
  }

  const suggestions = response.predictions.map(item => {
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
  const query = {
    key: process.env.GOOGLE_API_KEY,
    input: input.name,
    components: 'country:' + input.country,
    types: 'geocode',
  };

  switch (input.hint) {
    case 'latlon':
      query.location = [input.lat, input.lon].join(',');
      query.radius = input.radius * 1000;
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
  .then(suggestions => {
    return {
      suggestions: suggestions,
      maas: {
        query: query,
      },
    };
  });
}

module.exports.respond = function (event, callback) {
  adapt(event)
  .then(response => {
    callback(null, response);
  })
  .catch(err => {
    console.info('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
