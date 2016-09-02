'use strict';

const Promise = require('bluebird');
const bus = require('../../lib/service-bus');
const MaaSError = require('../../lib/errors/MaaSError');

function queryAutocomplete(event) {
  if (!event.payload || Object.keys(event.payload).length === 0) {
    return Promise.reject(new MaaSError('Missing or empty event payload', 401));
  }

  // Validate & set defaults
  const query = {
    name: event.payload.name,
    count: (parseInt(event.payload.count, 10)) === 0 ? 5 : event.payload.count,
    lat: event.payload.lat,
    lon: event.payload.lon,
  };

  // Inject input hints, typecast input
  if (typeof query.lat === 'string' && typeof query.lon === 'string') {
    query.lat = parseFloat(query.lat);
    query.lon = parseFloat(query.lon);
    query.hint = 'latlon';
  } else {
    query.hint = 'none';
  }

  if (typeof query.count === 'string') query.count = parseInt(query.count, 10);
  console.info(query);
  return bus.call('MaaS-provider-here-autocomplete', query);
}

module.exports.respond = function (event, callback) {

  return queryAutocomplete(event)
    .then(results => {
      callback(null, results);
    })
    .catch(err => {
      console.info('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn('Error:', err.stack);

      // TODO Process the error
      callback(err);
    });
};
