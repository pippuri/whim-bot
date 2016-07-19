'use strict';

const Promise = require('bluebird');
const Subscription = require('../../lib/subscription-manager/index.js');

function getUserData(event) {
  const identityId = event.identityId;

  if (typeof identityId !== 'string') {
    return Promise.reject(new Error('Invalid or missing identityId'));
  }

  return Subscription.getUserSubscription(identityId);
}

function wrapToEnvelope(profile, event) {
  return {
    profile: profile,
    maas: {
      query: event,
    },
  };
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return getUserData(event)
    .then(response => wrapToEnvelope(response, event))
    .then(envelope => callback(null, envelope))
    .catch(error => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2), error);
      callback(error);
    });
};
