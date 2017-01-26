'use strict';

const Database = require('../../lib/models/Database');
const MaaSError = require('../../lib/errors/MaaSError');
const Profile = require('../../lib/business-objects/Profile');
const Transaction = require('../../lib/business-objects/Transaction');
const SubscriptionManager = require('../../lib/business-objects/SubscriptionManager');
const validator = require('../../lib/validator');
const ValidationError = require('../../lib/validator/ValidationError');
const utils = require('../../lib/utils');

const schema = require('maas-schemas/prebuilt/maas-backend/subscriptions/subscriptions-update/request.json');

function validatePermissions(customerId, userId) {
  // Currently we only support the case where customer equals user. This may
  // change in the future.
  if (customerId !== userId) {
    const message = `Access denied: User '${customerId}' has no rights to modify the subscription of ${userId}`;
    return Promise.reject(new MaaSError(message, 403));
  }

  // Everything ok
  return Promise.resolve();
}

/**
 * Validates that the given items can be purchased together (e.g. some add-ons)
 * may be valid only for some given plans etc.
 *
 * Currently only checks that top-up points cannot be bundled with other
 * purchase logics, because they would be overriden by other changes.
 *
 * TODO Validate the subscription according to our plans, e.g.
 * check the current user subscription and that the addons fit the
 * addons available in subscription options.
 *
 * @param {object} subscription - The subscription to validate
 * @param {boolean} replace - Whether or not we should replace the entire subscription
 * @return {Promise<object|ValidationError>} the validated subscription
 */
function validateLogicConflicts(subscription, replace) {
  const addons = subscription.addons || [];
  const topupId = SubscriptionManager.TOPUP_ID;
  const containsTopUp = subscription.addons.some(addon => addon.id === topupId);

  // Top-ups cannot replace the other add-ons
  if (containsTopUp && replace === true) {
    const message = 'Top-up cannot replace the other purchases';
    return Promise.reject(ValidationError.fromValue('.', subscription, message,
      subscription));
  }

  // Top-ups cannot be purchased as a bundle to something else
  const hasOtherChanges = typeof subscription.plan !== 'undefined' || addons.length !== 1;

  if (containsTopUp && hasOtherChanges) {
    const message = 'Top-up cannot be purchased as a bundle with other items';
    return Promise.reject(ValidationError.fromValue('.', subscription, message,
      subscription));
  }

  return Promise.resolve(subscription);
}

/**
 * Converts the input from subscription option format to subscription format
 *
 * @param {object} - option Subscription option (event payload)
 * @return {object} subscription that is parsed from the option
 */
function parseSubscriptionFromOption(option) {
  const subscription = {
    addons: (option.addons || []).map(a => ({ id: a.id, quantity: a.quantity })),
    coupons: (option.coupons || []).map(c => ({ id: c.id })),
  };

  if (typeof option.plan === 'object') {
    subscription.plan =  { id: option.plan.id };
  }

  return subscription;
}

module.exports.respond = function (event, callback) {
  const validationOptions = {
    coerceTypes: true,
    useDefaults: true,
    sanitize: true,
  };
  let validated;

  return Database.init()
    .then(() => validator.validate(schema, event, validationOptions))
    .then(_validated => (validated = _validated))
    .then(() => validatePermissions(validated.customerId, validated.userId))
    .then(() => validateLogicConflicts(parseSubscriptionFromOption(validated.payload, validated.replace)))
    .then(subscription => {
      const customerId = validated.customerId;
      const userId = validated.userId;
      const replace = validated.replace;

      const xa = new Transaction(userId);
      return xa.start()
        .then(() => SubscriptionManager.updateSubscription(
          subscription,
          customerId,
          userId,
          true,
          replace
        ))
        .catch(error => xa.rollback().then(() => Promise.reject(error)))
        .then(updated => {
          // Special case: Check if we had any top-up points that would need to
          // be updated immediately. They don't show up in updated subscription.
          const topupId = SubscriptionManager.TOPUP_ID;
          const addons = subscription.addons || [];
          const topup = addons.find(addon => addon.id === topupId);

          if (!topup) {
            return xa.commit('Issue subscription change')
              .then(() => updated);
          }

          const points = topup.quantity;
          return Profile.increaseBalance(userId, points, xa)
            .then(() => xa.commit(`Top-up balance by ${points} points.`))
            .then(() => updated);
        });
    })
    .then(subscription => SubscriptionManager.annotateSubscription(subscription))
    .then(subs => ({ subscription: subs, debug: { event: event } }))
    .then(
      results => Database.cleanup().then(() => results),
      error => Database.cleanup().then(() => Promise.reject(error))
    )
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
