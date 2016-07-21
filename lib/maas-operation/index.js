'use strict';

const bus = require('../service-bus');
const MaaSError = require('../errors/MaaSError.js');
// const Promise = require('bluebird');

/**
 * Fetch customer profile from Dynamo by identityId
 * @param  {UUID} identityId [description]
 * @return {Object} profile data
 */
function fetchCustomerProfile(identityId) {
  //console.log(`Fetch customer profile ${identityId}`);

  return bus.call('MaaS-profile-info', {
    identityId: identityId,
  })
  .then(data => {
    // Append identity ID
    // FIXME The 'Item' envelope is unnecessary in profile
    return Object.assign({ identityId: identityId }, data.Item);
  });
}

/**
 * Compute new user balance based on the current balance and itinerary cost
 * @param  {Object} cost - decrease cost
 * @param  {Profile} profile - contains balance
 * @return {Float} new balance after computing
 */
function computeBalance(cost, profile) {

  // Check that the user has sufficient balance
  const balance = profile.balance;
  const message = `Insufficent balance (required: ${cost}, actual: ${balance})`;

  if (balance > cost) {
    return balance - cost;
  }

  throw new MaaSError(message, 403);
}

/**
 * Put the new balance into custom profile dynamo
 * @param  {UUID} identityId
 * @param  {Float} newBalance
 * @return {Object} changes
 */
function updateBalance(identityId, newBalance) {
  console.log(`Update new balance ${newBalance}`);

  return bus.call('MaaS-profile-edit', {
    identityId: identityId,
    payload: {
      balance: newBalance,
    },
  });
}

module.exports = {
  fetchCustomerProfile: fetchCustomerProfile,
  computeBalance: computeBalance,
  updateBalance: updateBalance,
};
