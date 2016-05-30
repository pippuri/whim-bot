
var Promise = require('bluebird');
var lib = require('../../lib/utilities/index');
var bus = require('../../lib/service-bus/index');
var _ = require('lodash/core');

function updateUserData(event) {
  if (_.isEmpty(event)) {
    return Promise.reject(new Error('Input missing'));
  } else if (event.identityId === '' || !event.hasOwnProperty('identityId')) {
    return Promise.reject(new Error('Missing identityId'));
  }

  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null)
    .then((response) => {
      if (response === false) { // True if existed
        return Promise.reject(new Error('User Not Existed'));
      }

      _.forEach(event.payload, (value, key) => {
        var params = {
          TableName: process.env.DYNAMO_USER_PROFILE,
          Key: {
            identityId: event.identityId,
          },
          UpdateExpression: 'SET #attr = :value',
          ExpressionAttributeNames: {
            '#attr': key,
          },
          ExpressionAttributeValues: {
            ':value': value,
          },
          ReturnValues: 'UPDATED_NEW',
          ReturnConsumedCapacity: 'INDEXES',
        };

        return bus.call('Dynamo-update', params);
      });
    });
}

/**
 * Export respond to Handler
 */
module.exports.respond = function (event, callback) {
  return updateUserData(event)
    .then((response) => {
      callback(null, response);
    })
    .catch((error) => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
