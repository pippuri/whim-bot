'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Profile = require('../../lib/business-objects/Profile');
const Pricing = require('../../lib/business-objects/Pricing');
const Promise = require('bluebird');
const SubscriptionManager = require('../../lib/business-objects/SubscriptionManager');
const Transaction = require('../../lib/business-objects/Transaction');

/**
 * Validate the input
 */
function parseAndValidateInput(event) {
  const identityId = event.identityId;

  if (typeof identityId !== 'string') {
    return Promise.reject(new MaaSError('Missing identity', 500));
  }

  if (typeof event.payload !== 'object') {
    return Promise.reject(new MaaSError('Missing payload', 500));
  }

  const params = event.payload;
  const points = parseInt(params.amount, 10);
  const limit = parseFloat(params.price, 10);
  const currency = params.currency;

  if (!(points > 0)) {
    return Promise.reject(new MaaSError(`Invalid or missing amount '${points}'`, 400));
  }

  if (!(limit > 0)) {
    return Promise.reject(new MaaSError(`Invalid or missing chargeOK '${limit}'`, 400));
  }

  if (typeof currency !== 'string') {
    return Promise.reject(new MaaSError('Missing currency', 400));
  }

  return Promise.resolve({
    identityId,
    points,
    limit,
    currency,
  });
}

function confirmCharge(identityId, points, limit, currency) {
  return Pricing.convertPointsToCost(points, currency)
    .then(cost => {
      if (cost > limit) {
        const m = `Could not charge ${cost} ${currency} for ${points}p top-up, user permitted only ${limit} ${currency}`;
        throw new MaaSError(m, 403);
      }

      console.info(`Top-up charge '${cost}' ${currency} confirmed for ${identityId}`);
      return {
        identityId,
        currency,
        points,
        cost,
        limit,
      };
    });
}

/**
 * Make the addon product purchase and update profile with new points tally
 */
function makePurchase(identityId, transaction, points) {
  return Profile.retrieve(identityId)
  .then(profile => {
    if (!profile) {
      throw new MaaSError('User not found', 404);
    }
    // delegate the purchase to subscription manager / charge manager
    const update = {
      addons: [{
        id: 'fi-whim-top-up',
        quantity: points,
      }],
    };
    return SubscriptionManager.updateSubscription(update, identityId, identityId, true, false);
  });
}

module.exports.respond = function (event, callback) {
  const transaction = new Transaction(event.identityId);
  let payload;

  return parseAndValidateInput(event)
    .then(parsed => {
      payload = parsed;
      transaction.meta(models.Profile.tableName, event.identityId);
      return models.Database.init()
        .then(() => transaction.start());
    })
    .then(() => confirmCharge(event.identityId, payload.points, payload.limit, payload.currency))
    .then(confirmed => makePurchase(confirmed.identityId, transaction, confirmed.points))
    .then(purchase => {
      return transaction.commit(`Topup order of ${payload.points}p`)
        .then(() => Profile.retrieve(event.identityId))
        .then(profile => {
          return Object.assign({}, purchase, { profile: profile });
        });
    })
    .then(response => {
      models.Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      return transaction.rollback()
        .then(() => models.Database.cleanup())
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
