'use strict';

const Database = require('../../lib/models/Database');
const MaaSError = require('../../lib/errors/MaaSError');
const Profile = require('../../lib/business-objects/Profile');
const Transaction = require('../../lib/business-objects/Transaction');
const utils = require('../../lib/utils');

function validateInput(event) {

  if (!event || !event.identityId) {
    return Promise.reject(new MaaSError('Missing identityId', 403));
  }

  if (!event.payload || Object.keys(event.payload) === 0) {
    return Promise.reject(new MaaSError('Payload empty', 400));
  }

  return Promise.resolve();
}

function formatResponse(profile) {
  return {
    profile: utils.sanitize(profile),
    debug: {},
  };
}

module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => validateInput(event))
    .then(() => {
      const identityId = event.identityId;
      const transaction = new Transaction(identityId);
      const locName = event.payload.name;

      return transaction.start()
        .then(() => Profile.removeFavoriteLocation(identityId, locName, transaction))
        .then(
          results => transaction.commit().then(() => results),
          error => transaction.rollback().then(() => Promise.reject(error))
        );
    })
    .then(
      profile => Database.cleanup().then(() => formatResponse(profile)),
      error => Database.cleanup().then(() => Promise.reject(error))
    )
    .then(response => callback(null, response))
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
