'use strict';

const Promise = require('bluebird');
const Subscription = require('../../lib/subscription-manager/index.js');

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
  console.log('Update credit card', payload)
  return Subscription.updateUserCreditCard(identityId, payload);
}

function wrapToEnvelope(resp, event) {
  return {
    response: resp,
  };
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return updateUserData(event)
    .then(response => wrapToEnvelope(response, event))
    .then(envelope => callback(null, envelope))
    .catch(error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn('Error: ' + JSON.stringify(error.toString(), null, 2));
      if (error && error.hasOwnPropert('response')) {
        console.info(error.response.toString());
        callback(error.response.toString());
      } else {
        callback(error);
      }
    });
};
