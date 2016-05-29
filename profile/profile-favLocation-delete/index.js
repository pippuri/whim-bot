
var Promise = require('bluebird');
var lib = require('../../lib/profile/index');
var bus = require('../../lib/service-bus/index');
var _ = require('lodash/core');

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
        return bus.call('Dynamo-get', params);
      } else {
        return Promise.reject(new Error('User Not Existed'));
      }
    })
    .then((response) => {
      for (var i = response.Item.favLocation.length - 1; i > -1; i--) {
        if (response.Item.favLocation[i].name === event.payload.identifier) {
          response.Item.favLocation.splice(i, 1);
        }
      }

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
      };
      return bus.call('Dynamo-update', params);
    });
}

module.exports.respond = function (event, callback) {
  return removeFavLocation(event)
    .then((response) => {
      callback(null, response);
    })
    .catch((error) => {
      console.log('This event caused error: ' + event);
      callback(error);
    });
};
