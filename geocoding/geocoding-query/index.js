'use strict';

const Promise = require('bluebird');
const bus = require('../../lib/service-bus');
const geolocation = require('../../lib/geolocation');
const validator = require('../../lib/validator');
const MaaSError = require('../../lib/errors/MaaSError');

function orderByDistance(results, reference) {
  const sorted = results.features.sort((a, b) => {
    const aGeo = {
      lat: a.geometry.coordinates[0],
      lon: a.geometry.coordinates[1],
    };
    const bGeo = {
      lat: b.geometry.coordinates[0],
      lon: b.geometry.coordinates[1],
    };

    return geolocation.distance(reference, bGeo) - geolocation.distance(reference, aGeo);
  });

  // Note: We modify the original object, which is an anti-pattern, but safe in this case
  results.features = sorted;

  return results;
}

module.exports.respond = function (event, callback) {
  // Parse and validate results
  return validator.validate('maas-backend:geocoding-query-request', event, { coerceTypes: true })
  .catch(error => Promise.reject(new MaaSError(`Validation failed: ${error.message}`, 400)))
  .then(parsed => bus.call('MaaS-provider-here-geocoding', parsed.payload))
  .then(results => {
    const reference = { lat: event.lat, lon: event.lon };
    return orderByDistance(results, reference);
  })
  .then(results => {
    // Replace the delegate query info with our own query
    results.debug = event.payload;
    callback(null, results);
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
};
