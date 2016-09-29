'use strict';

const Promise = require('bluebird');
const Subscription = require('../../lib/subscription-manager/index.js');
const MaaSError = require('../../lib/errors/MaaSError');

function createChargebeeUser(event) {
  console.log('Creating Chargebee user who did not exist', event);
  return Subscription.createUser(event.identityId, process.env.DEFAULT_WHIM_PLAN, event.payload)
    .then( user => {
      console.log(`Created user ${user}`);
      return Promise.resolve(user);
    })
    .catch( _err => {
      console.log('Error creating user:', _err.response.toString());
      return Promise.reject(new MaaSError(`Error creating Subscription: ${_err}`, 500));
    });
}

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
    .then( _ => Subscription.updateUserCreditCard(identityId, payload) )
    .catch( _error => {
      if (_error.statusCode === 404) {
        // chargebee did not have this user, let's add
        return createChargebeeUser(event);
      }
      return Promise.reject(new MaaSError(`Error with payment ${_error}`, 500));
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
      let err = _error.message;
      if (_error.response) {
        err = _error.response.toString();
      }
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);
      console.warn(`Response error: ${err}`);

      callback(new MaaSError(`Internal server error: ${err}`, 500));
    });
};
