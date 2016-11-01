'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');
const lib = require('../lib');
const MaaSError = require('../../lib/errors/MaaSError.js');

const ENDPOINT_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

function parseResults(response) {
  if (!util.isArray(response.results)) {
    const error = new MaaSError('Invalid response from Google - invalid format.', 500);
    return Promise.reject(error);
  }

  return Promise.resolve(lib.parseFeatures(response.results));
}

function adapt(input) {
  // Customise query by the hints given
  const query = {
    key: process.env.GOOGLE_API_KEY,
    address: input.name,
  };

  if (typeof input.lat !== 'number' || typeof input.lon !== 'number') {
    const message = 'Parameters lat and lon are required in the query';
    return Promise.reject(new MaaSError(message, 400));
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
  adapt(event)
  .then(response => (callback(null, response)))
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
};
