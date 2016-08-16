'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');
const lib = require('../lib');

const ENDPOINT_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

function parseResults(response) {
  if (!util.isArray(response.results)) {
    const error = new Error('Invalid response from Google - invalid format.');
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
    console.info('This event caused error: ' + JSON.stringify(event, null, 2));
    return callback(err);
  });
};
