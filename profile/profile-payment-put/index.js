'use strict';

const Promise = require('bluebird');
const Subscription = require('../../lib/subscription-manager/index.js');
const MaaSError = require('../../lib/errors/MaaSError');

function updateUserData(event) {
  const identityId = event.identityId;
  const payload = event.payload;

  if (Object.keys(event).length === 0) {
    return Promise.reject(new Error('Input missing'));
  }

  if (!event.hasOwnProperty('payload')) {
    return Promise.reject(new Error('Payload missing'));
  }

  if (typeof identityId !== 'string') {
    return Promise.reject(new Error('Invalid or missing identityId'));
  }
  return Subscription.updateUser(identityId, payload)
    .then( _ => Subscription.updateUserCreditCard(identityId, payload) );
}

function wrapToEnvelope(resp, event) {
  return {
    profile: resp,
  };
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return updateUserData(event)
    .then(response => wrapToEnvelope(response, event))
    .then(envelope => callback(null, envelope))
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
