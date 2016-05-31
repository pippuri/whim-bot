
var Promise = require('bluebird');
var lib = require('../../lib/utilities/index');
var bus = require('../../lib/service-bus/index');
var _ = require('lodash/core');

/**
 * Save data to DynamoDB
 */
function persistUserData(event) {
  if (_.isEmpty(event)) {
    return Promise.reject(new Error('Input missing'));
  } else if (event.identityId === '' || !event.hasOwnProperty('identityId')) {
    return Promise.reject(new Error('Missing identityId'));
  }

  // TODO and regex check for identityId
  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null)
    .then((response) => {
      if (response === true) { // True if existed
        return Promise.reject(new Error('User Existed'));
      } else {
        var record = {
            identityId: event.identityId,
            balance: 0,
            plans: [],
            favoriteLocations: [],
            phone: event.payload.phone,
          };

        var params = {
          Item: record,
          TableName: process.env.DYNAMO_USER_PROFILE,
        };

        return bus.call('Dynamo-put', params);
      }
    });
}

/**
 * Export respond to Handler
 */
module.exports.respond = function (event, callback) {
  return persistUserData(event)
    .then((response) => {
      callback(null, response);
    })
    .catch((error) => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
