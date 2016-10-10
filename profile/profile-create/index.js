'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const mgr = require('../../lib/subscription-manager');
const models = require('../../lib/models');

const Database = models.Database;
const Profile = models.Profile;

/**
 * Validate lambda event input
 */
function validateInput(event) {
  if (!event) return Promise.reject(new MaaSError('Missing or empty event input', 400));
  if (!event.identityId) return Promise.reject(new MaaSError('Missing identityId', 401));
  if (!event.payload || !event.payload.phone) return Promise.reject(new MaaSError('Missing payload or phone number inside payload', 400));

  return Promise.resolve();
}

/**
 * Create new user profile and persist it to postgres
 */
function createProfile(event) {

  if (event.identityId === '' || !event.hasOwnProperty('identityId')) {
    return Promise.reject(new Error('Missing identityId'));
  }

  return Profile.create(event.identityId, event.payload.phone)
    .then(user => {
      return mgr.createUser(event.identityId, process.env.DEFAULT_WHIM_PLAN, {
        phone: event.payload.phone,
      });
    });
}

module.exports.respond = (event, callback) => {

  return Database.init()
    .then(() => validateInput(event))
    .then(() => createProfile(event))
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
