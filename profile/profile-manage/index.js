'use strict';

const Promise = require('bluebird');
const Subscription = require('../../lib/subscription-manager');

function getUserData(event) {
  const identityId = event.identityId;

  if (typeof identityId !== 'string') {
    return Promise.reject(new Error('Invalid or missing identityId'));
  }

  return Subscription.getLoginURL(identityId);
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
      console.info('This event caused error: ' + JSON.stringify(event, null, 2), error);
      callback(error);
    });
};
