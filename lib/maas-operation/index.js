'use strict';

const bus = require('../service-bus');
const MaaSError = require('../errors/MaaSError.js');
const Promise = require('bluebird');

/**
 * Fetch customer profile from Dynamo by identityId
 * @param  {UUID} identityId [description]
 * @return {Object} profile data
 */
function fetchCustomerProfile(identityId) {
  //console.info(`Fetch customer profile ${identityId}`);

  return bus.call('MaaS-profile-info', {
    identityId: identityId,
  });
}

/**
 * Update customer profile in Dynamo by identityId
 * @param  {UUID} identityId [description]
 * @return {Object} profile data
 */
function updateCustomerProfile(identityId, content) {

  return bus.call('MaaS-profile-edit', {
    identityId: identityId,
    payload: content,
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
  const newBalance = Math.round((balance - cost) * 100) / 100;

  const message = `Insufficent balance (required: ${cost}, actual: ${balance})`;
  console.info(`Cost '${cost}' for profile '${profile.identityId}`);
  console.info(`Old balance '${balance}', new balance '${newBalance}`);

  if (balance >= cost) {
    return Promise.resolve(newBalance);
  }

  return Promise.reject(new MaaSError(message, 403));
}

/**
 * Put the new balance into custom profile dynamo
 * @param  {UUID} identityId
 * @param  {Float} newBalance
 * @return {Object} changes
 */
function updateBalance(identityId, newBalance) {
  newBalance = Math.floor(newBalance);
  console.info(`Update new balance ${newBalance} for identityId ${identityId}`);

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
