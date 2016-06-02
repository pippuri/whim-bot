
const Promise = require('bluebird');
const lib = require('../../lib/utilities/index');
const bus = require('../../lib/service-bus/index');

var planInfo;

// TODO get rid of all lodash require
function setActivePlan(event) {
  if (Object.keys(event).length === 0) {
    return Promise.reject(new Error('400: Input missing'));
  }

  if (event.identityId === '' || !event.hasOwnProperty('identityId')) {
    return Promise.reject(new Error('400 : Missing identityId'));
  }

  if (event.planId === '' || !event.hasOwnProperty('planId')) {
    return Promise.reject(new Error('400: Missing planId'));
  }

  // Get all package info with planId
  return bus.call('MaaS-store-single-package', {
    id: event.planId,
    type: 'plan',
  })
  .then(response => {
    planInfo = response;
    return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null);
  })
  .then(response => {
    if (response === false) { // False if not existed
      return Promise.reject(new Error('User Not Existed'));
    }

    const params = {
      TableName: process.env.DYNAMO_USER_PROFILE,
      Key: {
        identityId: event.identityId,
      },
      UpdateExpression: 'SET #plan_list = list_append(if_not_exists(#plan_list, :value), :value)',
      ExpressionAttributeNames: {
        '#plan_list': 'plans',
      },
      ExpressionAttributeValues: {
        ':value': [planInfo],
      },
      ReturnValues: 'UPDATED_NEW',
      ReturnConsumedCapacity: 'INDEXES',
    };

    return bus.call('Dynamo-update', params);
  })
  .then(response => {
    const params2 = {
      identityId: event.identityId,
    };
    return bus.call('MaaS-profile-info', params2);
  });
}

module.exports.respond = (event, callback) => {
  setActivePlan(event)
    .then(response => {
      if (response.Item.hasOwnProperty('identityId')) {
        delete response.Item.identityId;
      }

      callback(null, response);
    })
    .catch(error => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
