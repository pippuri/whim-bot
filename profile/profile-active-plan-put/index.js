'use strict';

const Promise = require('bluebird');
const lib = require('../../lib/utils/index');
const bus = require('../../lib/service-bus/index');
const Subscriptions = require('../../lib/subscription-manager/index');
const MaaSError = require('../../lib/errors/MaaSError.js');

function setActivePlan(event) {
  let oldLevel;
  let oldBalance;
  let newPlan;
  if (Object.keys(event).length === 0) {
    return Promise.reject(new MaaSError('Missing input keys', 400));
  }

  if (event.identityId === '' || !event.hasOwnProperty('identityId')) {
    return Promise.reject(new MaaSError('Missing identityId', 400));
  }

  if (event.planId === '' || !event.hasOwnProperty('planId')) {
    return Promise.reject(new MaaSError('Missing planId', 400));
  }

  // First check user existence
  return lib.documentExist(process.env.DYNAMO_USER_PROFILE, 'identityId', event.identityId, null, null)
    .then(documentExist => {
      if (documentExist === false) { // False if not existed
        return Promise.reject(new Error('User Not Existed'));
      }
      return Promise.resolve();
    })
    .then( _ => {
      // update chargebee with the plan,
      // webhook will specify (skipUpdate)
      if (!event.skipUpdate) {
        return Subscriptions.updatePlan(event.identityId, event.planId, event.promoCode);
      }
      return Promise.resolve({});
    })
    .then( _ => {
      return bus.call('MaaS-profile-info', { // Then get user balance
        identityId: event.identityId,
        attributes: 'balance,planlevel',
      });
    })
    .then(response => { // Then retrieve plan information
      oldBalance = response.Item.balance;
      oldLevel = response.Item.planlevel ? response.Item.planlevel : 0;
      return bus.call('MaaS-store-single-package', {
        id: event.planId,
        type: 'plan',
      });
    })
    .then(plan => { // Then update user profile with new plan information
      newPlan = plan;
      const params = {
        TableName: process.env.DYNAMO_USER_PROFILE,
        Key: {
          identityId: event.identityId,
        },
        UpdateExpression: 'SET #plan_list = :value',
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
    .then(response => { // Then set the new point balance
      console.info('New pointGrant: ', newPlan.pointGrant);
      console.info('Old balance: ', oldBalance);
      console.info('Old level: ', oldLevel);
      console.info('New level: ', newPlan.level);
      let newBalance = oldBalance;
      if (newPlan.level > 0 && (newPlan.level > oldLevel)) {
        // handle upgrade
        const slices = newPlan.tiers.slice(oldLevel, newPlan.level); // slice the array with tiers from zero
        for (const level of slices) {
          newBalance += level;
        }
        console.info('New tier grant', newBalance);
      } else if (newPlan.level === oldLevel) {
        return Promise.resolve( { message: 'Old plan already the same level' } );
      } else {
        // this was a downgrade
        if (newBalance > newPlan.pointGrant) {
          newBalance = newPlan.pointGrant;
        }
        console.info('Downgrade: points', newBalance);
      }
      const params2 = {
        identityId: event.identityId,
        payload: {
          balance: newBalance,
          planlevel: newPlan.level,
        },
      };
      console.info(params2);
      return bus.call('MaaS-profile-edit', params2);
    })
    .then(response => { // Then get new profile information
      const params3 = {
        identityId: event.identityId,
      };
      return bus.call('MaaS-profile-info', params3);
    });
}

module.exports.respond = (event, callback) => {
  setActivePlan(event)
    .then(response => { // Finally delete identityId from response if it exist
      if (response.Item.hasOwnProperty('identityId')) {
        delete response.Item.identityId;
      }

      callback(null, response);
    })
    .catch(error => {
      console.info('Caught an error: ' + JSON.stringify(error, null, 2));
      console.info('This event caused error: ' + JSON.stringify(event, null, 2));

      if (error instanceof MaaSError) {
        callback(error);
        return;
      }

      callback(new MaaSError(`Unexpected error: ${JSON.stringify(error)}`, 500));
    });
};
