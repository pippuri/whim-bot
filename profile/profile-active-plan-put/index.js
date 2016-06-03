
const Promise = require('bluebird');
const lib = require('../../lib/utilities/index');
const bus = require('../../lib/service-bus/index');

var newPlan;

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

  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null)
    .then(documentExist => {
      if (documentExist === false) { // False if not existed
        return Promise.reject(new Error('User Not Existed'));
      }

      return bus.call('MaaS-store-single-package', {
        id: event.planId,
        type: 'plan',
      });
    })
  .then(plan => {
    newPlan = plan;
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
        ':value': [newPlan],
      },
      ReturnValues: 'UPDATED_NEW',
      ReturnConsumedCapacity: 'INDEXES',
    };

    return bus.call('Dynamo-update', params);
  })
  .then(response => {
    const params2 = {
      identityId: event.identityId,
      payload: {
        balance: newPlan.pointGrant,
      },
    };
    return bus.call('MaaS-profile-edit', params2);
  })
  .then(response => {
    const params3 = {
      identityId: event.identityId,
    };
    return bus.call('MaaS-profile-info', params3);
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
