'use strict';

const request = require('request-promise-lite');
const MaaSError = require('../../../lib/errors/MaaSError.js');

const TRIPGO_REGIONS_URL = 'https://tripgo.skedgo.com/satapp/regions.json';

// Get regions from TripGo
function getTripGoRegions() {
  return request.get(TRIPGO_REGIONS_URL, {
    json: true,
    headers: {
      'X-TripGo-Key': process.env.TRIPGO_API_KEY,
    },
  });
}

module.exports.respond = function (event, callback) {
  getTripGoRegions()
  .then(response => {
    callback(null, response);
  })
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
