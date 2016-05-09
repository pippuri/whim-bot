
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var DOC = require('dynamodb-doc');
var lib = require('../lib/adapter');

var dynamo = new AWS.DynamoDB({ region: process.env.AWS_REGION });
var docClient = new DOC.DynamoDB(dynamo);

Promise.promisifyAll(docClient);

/**
 * Get single user data from database
 * TODO check phoneNumber format
 * TODO Move all TableName to env variables
 */
function getSingleUserData(phoneNumber) {
  if (!phoneNumber) {
    var error = new Error('Invalid profile data');
    return Promise.reject(error);
  }

  return lib.getCognitoDeveloperIdentity(phoneNumber)
    .then((response) => {
      var params = {
        TableName: 'maas-user-profile',
        Key: {
          IdentityId: response.identityId,
        },
      };

      return docClient.getItemAsync(params);
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
  return getSingleUserData(event.phoneCountryCode + event.plainPhone)
    .then((response) => {
      callback(null, response);
    })
    .catch((error) => {
      callback(error);
    });
};
