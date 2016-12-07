'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Profile = require('../../lib/business-objects/Profile');
const Promise = require('bluebird');
const SubscriptionMgr = require('../../lib/subscription-manager');
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
  const productId = params.productId;
  const points = parseInt(params.amount, 10);
  const limit = parseFloat(params.chargeOK, 10);

  if (!(points > 0)) {
    return Promise.reject(new MaaSError(`Invalid or missing amount '${points}'`, 400));
  }

  if (!(limit > 0)) {
    return Promise.reject(new MaaSError(`Invalid or missing chargeOK '${limit}'`, 400));
  }

  if (typeof productId !== 'string') {
    return Promise.reject(new MaaSError('Missing productId', 400));
  }

  return Promise.resolve({
    identityId,
    productId,
    points,
    limit,
  });
}

function confirmCharge(identityId, productId, points, limit) {
  return SubscriptionMgr.getAddonById(productId)
  .then(response => {
    const cost = response.addon.price * response.addon.meta_data.pointGrant * points;

    // Validate the user has OKd the change
    if (!(cost <= limit)) {
      const message = `Requested to charge '${cost}' cents, but the limit was '${limit}'`;
      return Promise.reject(new MaaSError(message, 403));
    }

    console.info(`Charge '${cost}' cents confirmed for ${identityId}`);
    return {
      identityId,
      productId,
      points,
      cost,
      limit,
    };
  });
}

/**
 * make the addon product purchase and update profile with new points tally
 */
function makePurchase(identityId, transaction, productId, cost, points) {
  return Profile.retrieve(identityId)
  .then(profile => {
    if (!profile) {
      throw new MaaSError('User not found', 404);
    }
    console.log(profile);
    // delegate the purchase to subscription manager / charge manager
    return SubscriptionMgr.makePurchase(identityId, productId, cost);
  })
  .then(purchase => {
    if (purchase.status === 'paid') {
      // update profile with the points the successful purchase grants
      return Profile.increaseBalance(identityId, points, transaction)
        .then(() => Promise.resolve(purchase));
    }
    return Promise.reject(new MaaSError(`Purchase failed on ChargeBee: ${purchase}`, 500));
  });
}

module.exports.respond = function (event, callback) {

  const transaction = new Transaction();
  let payload;

  return parseAndValidateInput(event)
    .then(parsed => {
      payload = parsed;
      models.Database.init()
        .then(() => transaction.start())
        .then(() => transaction.bind(models.Profile))
        .then(() => transaction.meta(models.Profile.tableName, event.identityId));
    })
    .then(() => confirmCharge(event.identityId, payload.productId, payload.points, payload.limit))
    .then(confirmed => makePurchase(confirmed.identityId, transaction, confirmed.productId, confirmed.cost, confirmed.points))
    .then(purchase => {
      return transaction.commit(`Topup ${payload.points}p`, event.identityId, payload.points)
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
