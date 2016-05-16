
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../lib/adapter');

var docClient = new AWS.DynamoDB.DocumentClient();

Promise.promisifyAll(docClient);

/**
 * Save data to DynamoDB
 */
function persistUserData(payload) {
  if (!payload) {
    return Promise.reject(new Error('Input missing'));
  } else if (payload.phoneCountryCode === undefined || payload.plainPhone === undefined) {
    return Promise.reject(new Error('Input missing phone number'));
  }

  return lib.getCognitoDeveloperIdentity(payload.phoneCountryCode + payload.plainPhone)
    .then((response) => {
      payload.IdentityId = response.identityId;
      var params = {
        Item: payload,
        TableName: process.env.DYNAMO_USER_PROFILE,
        ReturnValues: 'ALL_OLD',
        ReturnConsumedCapacity: 'TOTAL',
      };
      return docClient.putAsync(params);
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
