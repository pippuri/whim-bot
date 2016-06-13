'use strict';

const Promise = require('bluebird');
const lib = require('../../lib/utilities/index');
const bus = require('../../lib/service-bus/index');
const _ = require('lodash/core');

function removefavoriteLocations(event) {
  if (event.hasOwnProperty('identityId') && event.hasOwnProperty('payload')) {
    if (!_.isEmpty(event.payload)) {
      // No problem
    } else {
      return Promise.reject('400 Payload empty');
    }
  } else {
    return Promise.reject('400 Missing identityId or payload');
  }

  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null)
    .then((response) => {
      if (response === false) { // True means Existed
        return Promise.reject(new Error('User Not Existed'));
      }

      const params = {
        TableName: process.env.DYNAMO_USER_PROFILE,
        Key: {
          identityId: event.identityId,
        },
      };
      return bus.call('Dynamo-get', params);
    })
    .then((response) => {
      for (let i = response.Item.favoriteLocations.length - 1; i > -1; i--) {
        if (response.Item.favoriteLocations[i].name === event.payload.name) {
          response.Item.favoriteLocations.splice(i, 1);
        }
      }

      const params = {
        TableName: process.env.DYNAMO_USER_PROFILE,
        Key: {
          identityId: event.identityId,
        },
        UpdateExpression: 'SET #attr = :value',
        ExpressionAttributeNames: {
          '#attr': 'favoriteLocations',
        },
        ExpressionAttributeValues: {
          ':value': response.Item.favoriteLocations,
        },
      };
      return bus.call('Dynamo-update', params);
    });
}

module.exports.respond = (event, callback) => {
  return removefavoriteLocations(event)
    .then(response => callback(null, response))
    .catch(error => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
