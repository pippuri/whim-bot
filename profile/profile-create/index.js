
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var DOC = require('dynamodb-doc');
var lib = require('../lib/adapter');

var dynamo = new AWS.DynamoDB({ region: process.env.AWS_REGION });
var docClient = new DOC.DynamoDB(dynamo);

Promise.promisifyAll(docClient);

/**
 * Save data to DynamoDB
 */
function persistUserData(payload) {
  if (!payload) {
    var error = new Error('Invalid profile data');
    return Promise.reject(error);
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
      return docClient.putItemAsync(params);
    })
    .then((response) => {
      return response;
    })
    .catch((error) => {
      return error;
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
