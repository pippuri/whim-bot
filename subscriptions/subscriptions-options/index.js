'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const SubscriptionManager = require('../../lib/business-objects/SubscriptionManager');
const validator = require('../../lib/validator');
const ValidationError = require('../../lib/validator/ValidationError');
const utils = require('../../lib/utils');

const schema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-options-list/request.json');

module.exports.respond = function (event, callback) {
  const validationOptions = {
    coerceTypes: true,
  };

  return validator.validate(schema, event, validationOptions)
    .then(parsed => {
      const location = { lat: parsed.lat, lon: parsed.lon };
      return SubscriptionManager.findSubscriptionOptions(location);
    })
    .then(options => ({ options: options, debug: { event: event } }))
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
