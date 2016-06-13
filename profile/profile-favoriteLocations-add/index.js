'use strict';

const Promise = require('bluebird');
const lib = require('../../lib/utilities/index');
const bus = require('../../lib/service-bus/index');
const _ = require('lodash/core');

function addfavoriteLocations(event) {
  if (event.hasOwnProperty('identityId') && event.hasOwnProperty('payload')) {
    if (!_.isEmpty(event.payload)) {
      // No problem
    } else {
      return Promise.reject('405: Payload empty');
    }
  } else {
    return Promise.reject('400: Missing identityId or payload');
  }

  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null)
    .then(response => {
      if (response === false) { // False means NOT existed
        return Promise.reject(new Error('User Not Existed'));
      }

      // Check FL existance
      const query = {
        TableName: process.env.DYNAMO_USER_PROFILE,
        ExpressionAttributeNames: {
          '#priKey': 'identityId',
        },
        ExpressionAttributeValues: {
          ':priKeyValue': event.identityId,
        },
        KeyConditionExpression: '#priKey = :priKeyValue',
        ProjectionExpression: 'favoriteLocations',
      };
      return bus.call('Dynamo-query', query);
    })
    .then(response => {
      const favoriteLocations = response.Items[0].favoriteLocations;

      for (let i = 0; i < favoriteLocations.length; i++) {
        if (favoriteLocations[i].name === event.payload.name) {
          return Promise.reject(new Error('favoriteLocations name existed'));
        }
      }

      const params = {
        TableName: process.env.DYNAMO_USER_PROFILE,
        Key: {
          identityId: event.identityId,
        },
        UpdateExpression: 'SET #attr = list_append(#attr, :value)',
        ExpressionAttributeNames: {
          '#attr': 'favoriteLocations',
        },
        ExpressionAttributeValues: {
          ':value': [event.payload],
        },
      };
      return bus.call('Dynamo-update', params);
    });
}

module.exports.respond = (event, callback) => {
  return addfavoriteLocations(event)
    .then(response => callback(null, response))
    .catch((error) => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
