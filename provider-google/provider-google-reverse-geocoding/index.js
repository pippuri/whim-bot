'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');
const lib = require('../lib');
const MaaSError = require('../../lib/errors/MaaSError');

const ENDPOINT_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

function parseResults(response) {
  if (!util.isArray(response.results)) {
    const error = new MaaSError('Invalid response from Google - invalid format.', 500);
    return Promise.reject(error);
  }

  return Promise.resolve(lib.parseFeatures(response.results));
}

function adapt(input) {
  const query = {
    key: 'AIzaSyDoItUq6y7LTrZLQy-t7aXbfajgdBgRyco',
    latlng: input.lat + ',' + input.lon,
    language: input.lang,
  };
  query.result_type = 'street_address';
  return request.get(ENDPOINT_URL, {
    json: true,
    headers: {},
    qs: query,
  })
  .then(parseResults)
  .then(response => {
    response.debug = query;
    return response;
  });
}

module.exports.respond = function (event, callback) {
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
};
