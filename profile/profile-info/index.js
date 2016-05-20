
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var _ = require('lodash/core');

var docClient = new AWS.DynamoDB.DocumentClient();

Promise.promisifyAll(docClient);

/**
 * Get single user data from database
 */
function getSingleUserData(event) {

  if (event.hasOwnProperty('identityId') && event.identityId !== '') {
    // No problem
  } else {
    return Promise.reject(new Error('No input identityId'));
  }

  var params = {
    TableName: process.env.DYNAMO_USER_PROFILE,
    Key: {
      identityId: event.identityId,
    },
  };
  return docClient.getAsync(params);

}

/**
 * Export respond to Handler
 */
module.exports.respond = function (event, callback) {
  return getSingleUserData(event)
    .then((response) => {
      if (_.isEmpty(response)) {
        callback(new Error('Empty response / No item found with identityId ' + event.identityId));
      } else {
        callback(null, response);
      }
    })
    .catch((error) => {
      callback(error);
    });
};
