
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../lib/adapter');
var _ = require('lodash/core');

var docClient = new AWS.DynamoDB.DocumentClient();

Promise.promisifyAll(docClient);

/**
 * Save data to DynamoDB
 */
function persistUserData(event) {
  if (_.isEmpty(event)) {
    return Promise.reject(new Error('Input missing'));
  } else if (event.userId === '' || !event.hasOwnProperty('userId')) {
    return Promise.reject(new Error('Missing userId'));
  }

  console.log(event.userId);

  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'userId', event.userId, null, null)
    .then((response) => {
      if (response === false) { // False if existed
        return Promise.reject(new Error('User Existed'));
      } else if (response === true) {
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
