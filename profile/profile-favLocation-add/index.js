
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../lib/adapter');
var _ = require('lodash/core');

var docClient = new AWS.DynamoDB.DocumentClient();
Promise.promisifyAll(docClient);

function addFavLocation(event) {
  if (event.hasOwnProperty('identityId') && event.hasOwnProperty('payload')) {
    if (!_.isEmpty(event.payload)) {
      // No problem
    } else {
      return Promise.reject('Payload empty');
    }
  } else {
    return Promise.reject('Missing identityId or payload');
  }

  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null)
    .then((response) => {
      if (response === true) { // True means Existed
        var params = {
          TableName: process.env.DYNAMO_USER_PROFILE,
          Key: {
            identityId: event.identityId,
          },
          UpdateExpression: 'SET #attr = list_append(#attr, :value)',
          ExpressionAttributeNames: {
            '#attr': 'favLocation',
          },
          ExpressionAttributeValues: {
            ':value': [event.payload],
          },
          ReturnConsumedCapacity: 'INDEXES',
        };
        return docClient.updateAsync(params);
      } else {
        return Promise.reject(new Error('User Not Existed'));
      }
    })
    .then((response) => {
      if (response === null) {
        return Promise.reject(new Error('Operation failed'));
      } else {
        return Promise.resolve(response);
      }
    });
}

module.exports.respond = function (event, callback) {
  return addFavLocation(event)
    .then((response) => {
      callback(null, response);
    })
    .then((error) => {
      callback(error);
    });
};
