'use strict';

const Database = require('../../lib/models/Database');
const MaaSError = require('../../lib/errors/MaaSError');
const Profile = require('../../lib/business-objects/Profile');
const Transaction = require('../../lib/business-objects/Transaction');
const utils = require('../../lib/utils');

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

function formatResponse(profile) {
  return {
    profile: utils.sanitize(profile),
    debug: {},
  };
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => validateInput(event))
    .then(() => {
      const identityId = event.identityId;
      const transaction = new Transaction(identityId);

      return transaction.start()
        .then(() => Profile.update(identityId, event.payload, transaction))
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

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
