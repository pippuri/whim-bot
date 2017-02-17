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

module.exports.respond = async (event, callback) => {
  try {
    await Database.init().then(() => {});
    const profile = await retrieveProfile(event);
    await Database.cleanup().then(() => {
      callback(null, formatResponse(profile));
    });
  } catch (_error) {
    console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);
    if (Database._handleCount > 0) {
      await Database.cleanup().then(() => {
        callback(_error);
      });
    } else {
      callback(_error);
    }
  }
};
