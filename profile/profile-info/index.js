'use strict';

const Promise = require('bluebird');
const _ = require('lodash/core');

const serviceBus = require('../../lib/service-bus/index.js');

/**
 * Get single user data from database
 */
function getSingleUserData(event) {

  if (event.hasOwnProperty('identityId') && event.identityId !== '') {
    // No problem
  } else {
    return Promise.reject(new Error('No input identityId'));
  }

  const params = {
    TableName: process.env.DYNAMO_USER_PROFILE,
    Key: {
      identityId: event.identityId,
    },
  };

  if (event.hasOwnProperty('attributes') && event.attributes !== '') {
    params.ProjectionExpression = event.attributes.replace(/\s/g, ', ');
  }

  return serviceBus.call('Dynamo-get', params);

}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  getSingleUserData(event)
    .then(response => {
      if (_.isEmpty(response)) {
        callback(new Error('Empty response / No item found with identityId ' + event.identityId));
      } else {
        if (response.Item.hasOwnProperty('identityId')) {
          delete response.Item.identityId;
        }

        callback(null, response);
      }
    })
    .catch(error => {
      console.info('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
