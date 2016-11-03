'use strict';

const bus = require('../../lib/service-bus');
const MaaSError = require('../../lib/errors/MaaSError');
const validator = require('../../lib/validator');
const ValidationError = require('../../lib/validator/ValidationError');
const utils = require('../../lib/utils');

const schema = require('maas-schemas/prebuilt/maas-backend/geocoding/geocoding-query/request.json');

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
  const validationOptions = {
    coerceTypes: true,
    useDefaults: true,
    sanitize: true,
  };

  return validator.validate(schema, event, validationOptions)
    .then(parsed => queryAutoComplete(event.payload))
    .then(results => callback(null, utils.sanitize(results)))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof ValidationError) {
        callback(new MaaSError(_error.message, 400));
        return;
      }

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
