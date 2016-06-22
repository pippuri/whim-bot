'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');

const ENDPOINT_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

function getCityAddress(Address) {
  let tempAddress = [];
  tempAddress = Address.split(',');
  return ((tempAddress[tempAddress.length - 2]).replace(/\d+/g, '')).trim();
}

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
        city: getCityAddress(item.formatted_address),
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
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    return callback(err);
  });
};
