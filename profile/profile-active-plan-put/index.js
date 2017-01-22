'use strict';

const Database = require('../../lib/models/Database');
const MaaSError = require('../../lib/errors/MaaSError.js');
const schema = require('maas-schemas/prebuilt/maas-backend/profile/profile-active-plan-put/request.json');
const SubscriptionManager = require('../../lib/business-objects/SubscriptionManager');
const Transaction = require('../../lib/business-objects/Transaction');
const utils = require('../../lib/utils');
const validator = require('../../lib/validator');
const ValidationError = require('../../lib/validator/ValidationError');

function formatResponse(subscription) {
  return {
    subscription: utils.sanitize(subscription),
    debug: {},
  };
}

module.exports.respond = (event, callback) => {
  const validationOptions = {
    coerceTypes: true,
    useDefaults: true,
    sanitize: true,
  };

  return Database.init()
    .then(() => validator.validate(schema, event, validationOptions))
    .then(validated => {
      const identityId = validated.identityId;
      const planId = validated.planId;
      const promoCode = validated.promoCode;
      const transaction = new Transaction(identityId);

      const subscription = {
        plan: { id: planId },
        coupons: validated.promoCode ? [{ id: validated.promoCode }] : [],
      };

      return transaction.start()
        .then(() => SubscriptionManager.updateSubscription(subscription, identityId, identityId, true))
        .then(subscription => {
          const promoMessage = promoCode ? ` (promotion code ${promoCode})` : '';
          const msg = `Issued subscription change to ${planId}${promoMessage}`;
          return transaction.commit(msg).then(() => subscription);
        })
        .catch(error => transaction.rollback().then(() => Promise.reject(error)));
    })
    .then(
      subscription => Database.cleanup().then(() => formatResponse(subscription)),
      error => Database.cleanup().then(() => Promise.reject(error))
    )
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      if (_error instanceof ValidationError) {
        callback(new MaaSError(_error.message, 400));
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
