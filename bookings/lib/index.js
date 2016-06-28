'use strict';

const bus = require('../../lib/service-bus');
const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError.js');
const Promise = require('bluebird');

function fetchCustomerProfile(identityId) {
  //console.log(`Fetch customer profile ${identityId}`);

  // FIXME The 'Item' envelope is unnecessary in profile
  return bus.call('MaaS-profile-info', {
    identityId: identityId,
  })
  .then(data => {
    // Append identity ID
    return Object.assign({ identityId: identityId }, data.Item);
  });
}

function validateSignatures(input) {
  //console.log(`Validating input signature ${input.signature}`);

  // Verify that the data matches the signature
  const originalSignature = input.signature;
  const withoutSignature = Object.assign({}, input);
  delete withoutSignature.signature;

  const computedSignature = utils.sign(withoutSignature, process.env.MAAS_SIGNING_SECRET);

  if (originalSignature === computedSignature) {
    return Promise.resolve(input);
  }

  console.warn(`Validation failed. Current: ${originalSignature} Expected: ${computedSignature}`);

  // FIXME change routeId term
  return Promise.reject(new MaaSError('Signature validation failed.', 400));
}

function removeSignatures(input) {
  delete input.signature;

  return input;
}

// FIXME change itinerary cost to booking cost
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
  validateSignatures: validateSignatures,
  removeSignatures: removeSignatures,
  computeBalance: computeBalance,
  updateBalance: updateBalance,
};
