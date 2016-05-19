
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../lib/adapter');
var _ = require('lodash/core');

var docClient = new AWS.DynamoDB.DocumentClient();

Promise.promisifyAll(docClient);

function updateUserData(event) {
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
          return docClient.updateAsync(params);
        });

      }
    });
}

/**
 * Export respond to Handler
 */
module.exports.respond = function (event, callback) {
  return updateUserData(event)
    .then((response) => {
      console.log(response);
      callback(null, response);
    })
    .catch((error) => {
      callback(error);
    });
};
