'use strict';

const Promise = require('bluebird');
const Subscription = require('../../lib/subscription-manager');
const MaaSError = require('../../lib/errors/MaaSError');

function updateUserData(event) {
  const identityId = event.identityId;
  const payload = event.payload;

  if (Object.keys(event).length === 0) {
    return Promise.reject(new MaaSError('Input missing', 400));
  }

  if (!event.hasOwnProperty('payload')) {
    return Promise.reject(new MaaSError('Payload missing', 400));
  }

  if (typeof identityId !== 'string') {
    return Promise.reject(new MaaSError('Invalid or missing identityId', 400));
  }
  return Subscription.updateUser(identityId, payload)
    .then( _ => Subscription.updateUserCreditCard(identityId, payload) )
    .catch(error => {
      console.warn('Caught an error:', JSON.stringify(error));
      console.warn(`Input: identityId='${identityId}', payload='${JSON.stringify(payload)}'`);
      console.warn(error.stack);

      const statusCode = error.statusCode ? error.statusCode : 500;
      const message = (error.response) ? error.response.toString() : error.message;

      return Promise.reject(new MaaSError(`Error with payment: ${message}`, statusCode));
    });
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
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
