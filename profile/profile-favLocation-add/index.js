
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var lib = require('../../lib/profile/index');
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
      if (response === false) { // False means NOT existed
        return Promise.reject(new Error('User Not Existed'));
      }

      // Check FL existance
      var query = {
        TableName: process.env.DYNAMO_USER_PROFILE,
        ExpressionAttributeNames: {
          '#priKey': 'identityId',
        },
        ExpressionAttributeValues: {
          ':priKeyValue': event.identityId,
        },
        KeyConditionExpression: '#priKey = :priKeyValue',
        ProjectionExpression: 'favLocation',
      };
      return docClient.queryAsync(query);
    })
    .then((response) => {
      var favLocations = response.Items[0].favLocation;

      for (var i = 0; i < favLocations.length; i++) {
        if (favLocations[i].name === event.payload.name) {
          return Promise.reject(new Error('favLocation name existed'));
        }
      }

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
      };
      return docClient.updateAsync(params);
    });
}

module.exports.respond = function (event, callback) {
  return addFavLocation(event)
    .then((response) => {
      callback(null, response);
    })
    .catch((error) => {
      callback(error);
    });
};
