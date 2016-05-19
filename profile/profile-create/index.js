
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../../lib/ultilities/adapter');
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

  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null)
    .then((response) => {
      if (response === false) { // False if existed
        return Promise.reject(new Error('User Existed'));
      } else if (response === true) {
        event.payload.identityId = event.identityId;
        var params = {
          Item: event.payload,
          TableName: process.env.DYNAMO_USER_PROFILE,
          ReturnValues: 'NONE',
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
