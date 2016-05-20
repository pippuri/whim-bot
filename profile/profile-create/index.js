
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../../lib/profile/index');
var _ = require('lodash/core');

var docClient = new AWS.DynamoDB.DocumentClient();

Promise.promisifyAll(docClient);

/**
 * Save data to DynamoDB
 */
function persistUserData(event) {
  console.log(event);
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
            plan: [],
            favLocation: [],
            phone: event.payload.phone,
          };

        var params = {
          Item: record,
          TableName: process.env.DYNAMO_USER_PROFILE,
        };
        return docClient.putAsync(params);
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
      callback(error);
    });
};
