'use strict';

var Promise = require('bluebird');
var lib = require('../../lib/utilities/index');
var bus = require('../../lib/service-bus/index');
var moment = require('moment');

/**
 * Save route and time start of route onto DyanomoDB
 */
function saveRoute(event) {
  if (event.hasOwnProperty('route') && event.route !== '') {
    // No problem
  } else {
    return Promise.reject(new Error('No input route'));
  }

  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new Error('Missing identityId'));
  }

  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null)
    .then((response) => {
      if (response === false) { // True if existed
        return Promise.reject(new Error('User not existed'));
      }

      var item = {
        identityId: event.identityId,
        timeEpoch: moment().unix(),
        route: event.route,
      };
      var params = {
        TableName: process.env.DYNAMO_USER_TRAVEL_LOG,
        Item: item,
      };
      return bus.call('Dynamo-put', params);
    });
}

module.exports.respond = function (event, callback) {
  return saveRoute(event)
    .then((response) => {
      callback(null, response);
    })
    .catch((error) => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
