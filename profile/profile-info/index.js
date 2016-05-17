
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var _ = require('lodash/core');

var docClient = new AWS.DynamoDB.DocumentClient();

Promise.promisifyAll(docClient);

/**
 * Get single user data from database
 */
function getSingleUserData(userId) {

  if (typeof userId === typeof undefined || userId === '') {
    return Promise.reject(new Error('No input userId'));
  }

  var params = {
    TableName: process.env.DYNAMO_USER_PROFILE,
    Key: {
      userId: userId,
    },
  };
  return docClient.getAsync(params);

}

/**
 * Export respond to Handler
 */
module.exports.respond = function (event, callback) {
  return getSingleUserData(event.userId)
    .then((response) => {
      if (_.isEmpty(response)) {
        callback(new Error('Empty response / No item found with userId ' + event.userId));
      } else {
        callback(null, response);
      }
    })
    .catch((error) => {
      callback(error);
    });
};
