'use strict';

const Promise = require('bluebird');
const lib = require('../../lib/utilities/index');
const bus = require('../../lib/service-bus/index');
const _ = require('lodash');

/**
 * Save data to DynamoDB
 */
function persistUserData(event) {

  let defaultPlan;

  if (_.isEmpty(event)) {
    return Promise.reject(new Error('Input missing'));
  }

  if (event.identityId === '' || !event.hasOwnProperty('identityId')) {
    return Promise.reject(new Error('Missing identityId'));
  }

  return bus.call('MaaS-store-single-package', {
    id: process.env.DEFAULT_WHIM_PLAN,
    type: 'plan',
  })
  .then(plan => {
    defaultPlan = plan;
    return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null);
  })
  .then(documentExist => {
    if (documentExist === true) { // True if existed
      return Promise.reject(new Error('User Existed'));
    }

    const record = {
        identityId: event.identityId,
        balance: 0,
        plans: [defaultPlan],
        favoriteLocations: [],
        phone: event.payload.phone,
        profileImage: 'http://maas.fi/wp-content/uploads/2016/01/mugshot-sampo.png',
      };

    const params = {
      Item: record,
      TableName: process.env.DYNAMO_USER_PROFILE,
    };

    return bus.call('Dynamo-put', params);
  });
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return persistUserData(event)
    .then(response => callback(null, response))
    .catch(error => {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
