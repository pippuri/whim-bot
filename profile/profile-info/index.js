'use strict';

const Database = require('../../lib/models/Database');
const MaaSError = require('../../lib/errors/MaaSError');
const Profile = require('../../lib/business-objects/Profile');
const utils = require('../../lib/utils');

/**
 * Retrieve User data from Postgres
 */
function retrieveProfile(event) {

  if (event.hasOwnProperty('identityId') && event.identityId !== '') {
    // No problem
  } else {
    return Promise.reject(new MaaSError('No input identityId', 403));
  }
  const attributes = event.attributes ? event.attributes.split(',') : undefined;
  return Profile.retrieve(event.identityId, attributes);
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
    .then(() => retrieveProfile(event))
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
