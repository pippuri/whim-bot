
var Promise = require('bluebird');
var _ = require('lodash/core');

var serviceBus = require('../../lib/service-bus/index.js');

/**
 * Get single user data from database
 */
function getSingleUserData(event) {

  if (event.hasOwnProperty('identityId') && event.identityId !== '') {
    // No problem
  } else {
    return Promise.reject(new Error('No input identityId'));
  }

  var params = {
    TableName: process.env.DYNAMO_USER_PROFILE,
    Key: {
      identityId: event.identityId,
    },
  };
  return serviceBus.call('Dynamo-get', params);

}

/**
 * Export respond to Handler
 */
module.exports.respond = function (event, callback) {
  getSingleUserData(event)
    .then((response) => {
      if (_.isEmpty(response)) {
        callback(new Error('Empty response / No item found with identityId ' + event.identityId));
      } else {
        callback(null, response);
      }
    })
    .catch((error) => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
