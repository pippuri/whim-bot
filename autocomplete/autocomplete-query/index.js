'use strict';

const Promise = require('bluebird');
const bus = require('../../lib/service-bus');
const MaaSError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils');

/**
 * Parses and validates the event input
 * Contents: lat, lon, name, count (optional)
 *
 * @param {object} event The input event - see the contents above
 * @return {Promise} Object of parsed parameters if success, MaaSError otherwise
 */
function parseAndValidateInput(event) {
  if (typeof event.payload !== 'object') {
    const message = `Invalid or missing event.payload '${JSON.stringify(event.payload)}'`;
    return Promise.reject(new MaaSError(message, 400));
  }

  const name = (utils.isEmptyValue(event.payload.name)) ? undefined : event.payload.name;
  const lat = (utils.isEmptyValue(event.payload.lat)) ? undefined : parseFloat(event.payload.lat);
  const lon = (utils.isEmptyValue(event.payload.lon)) ? undefined : parseFloat(event.payload.lon);
  const count = (utils.isEmptyValue(event.payload.count)) ? 5 : parseInt(event.payload.count, 10);

  if (typeof name !== 'string') {
    return Promise.reject(new MaaSError(`Invalid of missing name value '${name}'`, 400));
  }

  if (!/[\d\s]*[\w]{3,}[\d\s]*/.test(name)) {
    const message = `Name value too short or invalid '${name}', expecting 3 or more letters, with optionally spaces or numbers`;
    return Promise.reject(new MaaSError(message, 400));
  }

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return Promise.reject(new MaaSError(`Invalid lat value '${lat}', must be -90 <= lat >= 90`, 400));
  }

  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return Promise.reject(new MaaSError(`Invalid lon value '${lon}', must be -90 <= lon >= 90`, 400));
  }

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    return Promise.reject(new MaaSError(`Invalid count value '${count}', must be 0 < count >= 100`, 400));
  }

  return Promise.resolve({
    name,
    lat,
    lon,
    count,
    hint: 'latlon',
  });
}

function queryAutoComplete(parsed) {
  // Validate & set defaults
  const query = {
    name: parsed.name,
    count: parsed.count,
    lat: parsed.lat,
    lon: parsed.lon,
    hint: parsed.hint,
  };

  return bus.call('MaaS-provider-here-autocomplete', query);
}

module.exports.respond = function (event, callback) {

  return parseAndValidateInput(event)
    .then(queryAutoComplete)
    .then(results => callback(null, results))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
