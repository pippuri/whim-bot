'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const Database = require('../../lib/models/Database');
const Profile = require('../../lib/business-objects/Profile');

function validateInput(event) {

  if (!event || !event.identityId) {
    return Promise.reject(new MaaSError('Missing identityId', 403));
  }

  if (!event.payload || Object.keys(event.payload) === 0) {
    return Promise.reject(new MaaSError('Payload empty', 400));
  }

  return Promise.resolve();
}

module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => validateInput(event))
    .then(() => Profile.addFavoriteLocation(event.identityId, event.payload))
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
