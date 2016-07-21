'use strict';

const bus = require('../service-bus');
const MaaSError = require('../errors/MaaSError.js');
const _ = require('lodash');
const DYNAMO_COLUMNS = ['phone', 'email', 'firstName', 'lastName', 'country', 'city', 'zip', 'status']

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
 * Update customer profile in Dynamo by identityId
 * @param  {UUID} identityId [description]
 * @return {Object} profile data
 */
function updateCustomerProfile(identityId, content) {
  const payload = {};
  for (let key of Object.keys(content)) {
    if (!_.find(DYNAMO_COLUMNS, k => { return key === k; })) return Promise.reject(new Error(`non-allowed column key ${key}`));
  }

  return bus.call('MaaS-profile-edit', {
    identityId: identityId,
    payload: content,
  })
  .then(data => {
    // Append identity ID
    // FIXME The 'Item' envelope is unnecessary in profile
    return Object.assign({ identityId: identityId }, data.Item);
  });
}

/**
 * Compute new user balance based on the current balance and itinerary cost
 * @param  {Object} itinerary - contains fare costs
 * @param  {Profile} profile - contains balance
 * @return {Float} new balance after computing
 * FIXME change itinerary cost to booking cost
 */
function computeBalance(itinerary, profile) {
  //console.log(`Computing balance for ${profile.identityId}`);

  // Check that the user has sufficient balance
  const cost = itinerary.fare.points;
  const balance = profile.balance;
  const message = `Insufficent balance (required: ${cost}, actual: ${balance})`;

  //console.log(`Balance ${profile.identityId}`);

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
  updateCustomerProfile: updateCustomerProfile,
  computeBalance: computeBalance,
  updateBalance: updateBalance,
};
