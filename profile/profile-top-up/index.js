'use strict';

// Dependency
const Promise = require('bluebird');

// Library
const SubscriptionMgr = require('../../lib/subscription-manager');
const lib = require('../../lib/maas-operation/index');
const MaaSError = require('../../lib/errors/MaaSError');

/**
 * make the addon product purchase and update profile with new points tally
 */

function buyPoints(identityId, productId, amount, pointGrant) {
  let currentBalance = 0;
  return lib.fetchCustomerProfile(identityId)
  .then( profile => {
    if (!profile) throw new MaaSError('User not found', 404);
    currentBalance = (profile.balance ? profile.balance : 0); // eslint-disable-line no-unneeded-ternary

    // delegate the purchase to subscription manager / charge manager
    return SubscriptionMgr.makePurchase(identityId, productId, amount);
  })
  .then( purchase => {
    if (purchase.status === 'paid') {
      // update profile with the points the successful purchase grants
      return lib.updateBalance(identityId, currentBalance + pointGrant);
    }
    return Promise.reject( { error: 'Purchase status:' + purchase.status } );
  });
}

/**
 * verify the points versus the amount user is OK'ing to pay
 */
function verifyPurchase(event) {
  if (!event.hasOwnProperty('identityId')) throw new MaaSError('Missing identity', 500);
  if (!event.hasOwnProperty('payload')) throw new MaaSError('Missing payload', 500);

  const params = event.payload;
  if (!params.hasOwnProperty('amount')) throw new MaaSError('Missing amount', 403);
  if (!params.hasOwnProperty('productId')) throw new MaaSError('Missing productId', 403);
  const amount = parseInt(params.amount, 10);

  // get the addon along with its metadata (point grant)
  return SubscriptionMgr.getAddonById(params.productId)
  .then( res => {

    //calculate the price according to the amount the user OK's to spend
    const price = res.addon.price * res.addon.meta_data.pointGrant * amount;

    // check that the user has OK'd the payment sum
    if (!params.hasOwnProperty('chargeOK') || (parseInt(params.chargeOK, 10) !== price)) {
      console.info(price, params.chargeOK);
      return Promise.resolve({ amount: amount, price: price, confirm: false, message: `Please confirm charge of ${price} cents for ${params.amount} points by supplying chargeOK parameter with the correct amount` });
    }

    // make the purchase and update profile
    return buyPoints(event.identityId, params.productId, amount, res.addon.meta_data.pointGrant * amount);
  });
}

module.exports.respond = function (event, callback) {
  verifyPurchase(event)
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      console.info('This event caused an error: ' + JSON.stringify(event, null, 2));
      console.warn('Error: ' + error.message);
      callback(error);
    });
};
