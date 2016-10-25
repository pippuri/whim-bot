'use strict';

const Database = require('../../lib/models/Database');
const MaaSError = require('../../lib/errors/MaaSError');
const Profile = require('../../lib/business-objects/Profile');
const Promise = require('bluebird');
const SubscriptionMgr = require('../../lib/subscription-manager');

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
function makePurchase(identityId, productId, cost, points) {
  let currentBalance;
  return Profile.retrieve(identityId)
  .then(profile => {
    if (!profile) {
      throw new MaaSError('User not found', 404);
    }
    currentBalance = (profile.balance ? profile.balance : 0);

    // delegate the purchase to subscription manager / charge manager
    return SubscriptionMgr.makePurchase(identityId, productId, cost);
  })
  .then(purchase => {
    if (purchase.status === 'paid') {
      // update profile with the points the successful purchase grants
      const newBalance = currentBalance + points;
      return Profile.update(identityId, { balance: newBalance })
        .then(profile => Object.assign({}, purchase, { profile: profile }));
    }
    return Promise.reject(new MaaSError(`Purchase failed on ChargeBee: ${purchase}`, 500));
  });
}

module.exports.respond = function (event, callback) {

  Database.init()
    .then(() => parseAndValidateInput(event))
    .then(parsed => confirmCharge(parsed.identityId, parsed.productId, parsed.points, parsed.limit))
    .then(confirmed => makePurchase(confirmed.identityId, confirmed.productId, confirmed.cost, confirmed.points))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
