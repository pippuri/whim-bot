'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');

const Database = models.Database;
const Profile = models.Profile;

function validateInput(event) {

  if (!event || !event.identityId) {
    return Promise.reject(new MaaSError('Missing identityId', 403));
  }

  if (!event.payload || Object.keys(event.payload) === 0) {
    return Promise.reject(new MaaSError('Payload empty', 400));
  }

  return Promise.resolve();
}

function removeFavoriteLocations(event) {
  return Profile.removeFavoriteLocation(event.identityId, event.payload.name);
}

module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => validateInput(event))
    .then(() => removeFavoriteLocations(event))
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
