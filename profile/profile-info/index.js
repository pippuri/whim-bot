
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../lib/adapter');
var _ = require('lodash/core');

var docClient = new AWS.DynamoDB.DocumentClient();

Promise.promisifyAll(docClient);

/**
 * Get single user data from database
 */
function getSingleUserData(phoneNumber) {
  if (!lib.checkPhoneNumber(phoneNumber)) {
    var error = new Error('Invalid profile data');
    return Promise.reject(error);
  }

  return lib.getCognitoDeveloperIdentity(phoneNumber)
    .then((response) => {
      var params = {
        TableName: process.env.DYNAMO_USER_PROFILE,
        Key: {
          IdentityId: response.identityId,
        },
      };
      return docClient.getAsync(params);
    });
}

/**
 * Export respond to Handler
 */
module.exports.respond = function (event, callback) {
  return getSingleUserData(event.phoneCountryCode + event.plainPhone)
    .then((response) => {
      if (_.isEmpty(response)) {
        callback(new Error('Empty response / No item found'));
      } else {
        callback(null, response);
      }
    })
    .catch((error) => {
      callback(error);
    });
};
