'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');

const Database = models.Database;
const Profile = models.Profile;

/**
 * Retrieve User data from Postgres
 */
function retrieveProfile(event) {

  if (event.hasOwnProperty('identityId') && event.identityId !== '') {
    // No problem
  } else {
    return Promise.reject(new MaaSError('No input identityId', 403));
  }

  return Profile.retrieve(event.identityId, event.attributes)
    .then(profile => {
      if (!profile) {
        return Promise.reject(new MaaSError('Profile not available', 403));
      }

      return profile;
    });
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => retrieveProfile(event))
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
