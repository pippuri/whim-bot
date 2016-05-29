
var Promise = require('bluebird');
var lib = require('../../lib/profile/index');
var bus = require('../../lib/service-bus/index');

var planInfo;

// TODO get rid of all lodash require
function setActivePlan(event) {
  if (Object.keys(event).length === 0) {
    return Promise.reject(new Error('Input missing'));
  } else if (event.identityId === '' || !event.hasOwnProperty('identityId')) {
    return Promise.reject(new Error('Missing identityId'));
  } else if (event.planId === '' || !event.hasOwnProperty('planId')) {
    return Promise.reject(new Error('Missing planId'));
  }

  // Get all package info with planId
  return bus.call('MaaS-store-single-package', {
    id: event.planId,
    type: 'plan',
  })
  .then((response) => {
    planInfo = response;
    return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null);
  })
  .then((response) => {
    if (response === true) { // True if existed
      var params = {
        TableName: process.env.DYNAMO_USER_PROFILE,
        Key: {
          identityId: event.identityId,
        },
        UpdateExpression: 'SET #attr = :value',
        ExpressionAttributeNames: {
          '#attr': 'plan',
        },
        ExpressionAttributeValues: {
          ':value': planInfo,
        },
        ReturnValues: 'UPDATED_NEW',
        ReturnConsumedCapacity: 'INDEXES',
      };

      return bus.call('Dynamo-update', params);
    } else {
      return Promise.reject(new Error('User Not Existed'));
    }
  })
  .then((response) => {
    var params2 = {
      identityId: event.identityId,
    };
    return bus.call('MaaS-profile-info', params2);
  });
}

module.exports.respond = (event, callback) => {
  setActivePlan(event)
    .then((response) => {
      callback(null, response);
    })
    .catch((error) => {
      console.log('This event caused error: ' + event);
      callback(error);
    });
};
