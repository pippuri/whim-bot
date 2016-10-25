'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const Database = require('../../lib/models/Database');
const Profile = require('../../lib/business-objects/Profile');

const EDITABLE_FIELDS = ['email', 'firstName', 'lastName', 'city', 'country',
'zipCode', 'profileImageUrl'];

function validateInput(event) {
  if (!event) {
    return Promise.reject(new MaaSError('Input missing', 400));
  }

  if (!event.identityId || typeof event.identityId !== 'string') {
    return Promise.reject(new MaaSError('Invalid or missing identityId', 403));
  }

  if (!event.payload || Object.keys(event.payload).length === 0) {
    return Promise.reject(new MaaSError('Payload empty, update request refused', 400));
  }

  for (let key of Object.keys(event.payload)) { // eslint-disable-line
    if (!EDITABLE_FIELDS.some(field => field === key)) {
      return Promise.reject(new MaaSError(`Cannot update field "${key}", request forbidden`, 403));
    }
  }

  return Promise.resolve();
}

function updateUserData(event) {
  return Profile.update(event.identityId, event.payload)
    .then(profile => {
      return {
        profile: profile,
        debug: {
          query: event,
        },
      };
    });
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => validateInput(event))
    .then(() => updateUserData(event))
    .then(profile => {
      Database.cleanup()
        .then(() => callback(null, profile));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
