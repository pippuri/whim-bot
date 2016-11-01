'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');
const MaaSError = require('../../lib/errors/MaaSError.js');

const ENDPOINT_URL = 'https://places.demo.api.here.com/places/v1/suggest';

function parseResults(response) {
  const suggestions = response.suggestions;

  if (!util.isArray(suggestions)) {
    const error = new MaaSError('Invalid response from HERE - invalid format.', 400);
    return Promise.reject(error);
  }

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
    app_id: process.env.HERE_APP_ID,
    app_code: process.env.HERE_APP_CODE,
    q: input.name,
  };

  switch (input.hint) {
    case 'latlon':
      query.at = [input.lat, input.lon].join(',');
      break;
    case 'none':
      break;
    default:
      throw new MaaSError('Location hint not given', 400);
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
    };
  });
}

module.exports.respond = function (event, callback) {
  if (typeof process.env.HERE_APP_ID === typeof undefined) {
    callback(new MaaSError('Missing HERE_APP_ID'), 400);
  } else if (typeof process.env.HERE_APP_CODE === typeof undefined) {
    callback(new MaaSError('Missing HERE_APP_CODE'), 400);
  } else {
    adapt(event)
    .then(response => {
      callback(null, response);
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
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
