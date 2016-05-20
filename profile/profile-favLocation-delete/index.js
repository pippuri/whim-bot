
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../../lib/profile/index');
var _ = require('lodash/core');

var docClient = new AWS.DynamoDB.DocumentClient();
Promise.promisifyAll(docClient);

function removeFavLocation(event) {
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
        };
        return docClient.getAsync(params);
      } else {
        return Promise.reject(new Error('User Not Existed'));
      }
    })
    .then((response) => {
      console.log('BEFORE ' + response.Item.favLocation);
      for (var i = response.Item.favLocation.length - 1; i > -1; i--) {
        if (response.Item.favLocation[i].name === event.payload.identifier) {
          response.Item.favLocation.splice(i, 1);
        }
      }

      console.log('AFTER ' + response.Item.favLocation);

      var params = {
        TableName: process.env.DYNAMO_USER_PROFILE,
        Key: {
          identityId: event.identityId,
        },
        UpdateExpression: 'SET #attr = :value',
        ExpressionAttributeNames: {
          '#attr': 'favLocation',
        },
        ExpressionAttributeValues: {
          ':value': response.Item.favLocation,
        },
        ReturnConsumedCapacity: 'INDEXES',
      };
      return docClient.updateAsync(params);
    });
}

module.exports.respond = function (event, callback) {
  return removeFavLocation(event)
    .then((response) => {
      callback(null, response);
    })
    .then((error) => {
      callback(error);
    });
};
