'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const lib = require('../../lib/utils/index');
const bus = require('../../lib/service-bus/index');
const mgr = require('../../lib/subscription-manager');
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
      // Default to pay as you go
      planlevel: 0,
      favoriteLocations: [],
      phone: event.payload.phone,
      profileImage: 'http://maas.fi/wp-content/uploads/2016/01/mugshot-sampo.png',
    };

    const params = {
      Item: record,
      TableName: process.env.DYNAMO_USER_PROFILE,
    };

    return bus.call('Dynamo-put', params);
  })
  .then(user => {
    return mgr.createUser(event.identityId, process.env.DEFAULT_WHIM_PLAN, { phone: event.payload.phone })
      .then( _ => {
        return user;
      });
  });

}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return persistUserData(event)
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
