'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const SubscriptionManager = require('../../lib/business-objects/SubscriptionManager');
const validator = require('../../lib/validator');
const ValidationError = require('../../lib/validator/ValidationError');
const utils = require('../../lib/utils');

const schema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-retrieve/request.json');

function validatePermissions(customerId, userId) {
  // Currently we only support the case where customer equals user. This may
  // change in the future.
  if (customerId !== userId) {
    const message = `Access denied: User '${customerId}' has no rights to retrieve the subscription of ${userId}`;
    return Promise.reject(new MaaSError(message, 403));
  }

  // Everything ok
  return Promise.resolve();
}

module.exports.respond = function (event, callback) {
  const validationOptions = {
    coerceTypes: true,
    useDefaults: true,
    sanitize: true,
  };
  let parsed;

  return validator.validate(schema, event, validationOptions)
    .then(_parsed => (parsed = _parsed))
    .then(() => validatePermissions(parsed.customerId, parsed.userId))
    .then(() => {
      const userId = parsed.userId;
      const nextPeriod = parsed.nextPeriod;

      return SubscriptionManager.retrieveSubscriptionByUserId(userId, nextPeriod)
        .then(subscription => SubscriptionManager.annotateSubscription(subscription));
    })
    .then(subs => ({ subscription: subs, debug: { event: event } }))
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
