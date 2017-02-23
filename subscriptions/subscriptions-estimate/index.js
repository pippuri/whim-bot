'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const SubscriptionManager = require('../../lib/business-objects/SubscriptionManager');
const validator = require('../../lib/validator');
const ValidationError = require('../../lib/validator/ValidationError');
const utils = require('../../lib/utils');

const schema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-estimate/request.json');

function validatePermissions(customerId, userId) {
  // Currently we only support the case where customer equals user. This may
  // change in the future.
  if (customerId !== userId) {
    const message = `Access denied: User '${customerId}' has no rights to estimate the subscription of ${userId}`;
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
  let validated;

  return validator.validate(schema, event, validationOptions)
    .then(_validated => (validated = _validated))
    .then(() => validatePermissions(validated.customerId, validated.userId))
    .then(() => SubscriptionManager.retrieveSubscriptionByUserId(validated.userId))
    .then(currentSubscription => {
      const targetSubscription = SubscriptionManager.fromSubscriptionOption(validated.payload);
      const customerId = validated.customerId;
      const userId = validated.userId;
      const replace = validated.replace;
      const addons = validated.payload.addons || [];
      let immediateUpdate = false;

      // If your current planId is payg or you are topping up, update immediately
      if (currentSubscription.plan.id === SubscriptionManager.DEFAULT_PLAN_ID ||
          addons.some(addon => addon.id === SubscriptionManager.TOPUP_ID)) {
        immediateUpdate = true;
      }

      return SubscriptionManager.estimateSubscriptionUpdate(targetSubscription, customerId, userId, immediateUpdate, replace);
    })
    .then(subs => ({ estimate: subs, debug: { event: event } }))
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
