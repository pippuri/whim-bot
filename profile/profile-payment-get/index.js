'use strict';

const Promise = require('bluebird');
const Subscription = require('../../lib/subscription-manager');
const MaaSError = require('../../lib/errors/MaaSError');

function getUserData(event) {
  const identityId = event.identityId;

  if (typeof identityId !== 'string') {
    return Promise.reject(new MaaSError('Invalid or missing identityId', 400));
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
