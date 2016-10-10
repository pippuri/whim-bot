'use strict';

const Promise = require('bluebird');
const bus = require('../../lib/service-bus/index');
const Subscriptions = require('../../lib/subscription-manager/index');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models');

const Database = models.Database;
const Profile = models.Profile;

function createChargebeeUser(event) {
  return Profile.retrieve(event.identityId)
    .then(profile => {
      return Subscriptions.createUser(event.identityId, process.env.DEFAULT_WHIM_PLAN, { phone: profile.phone })
        .then( user => {
          console.info(`Created user ${user}`);
          return Promise.resolve(user);
        })
        .catch( _err => {
          console.info('Error creating user:', _err.response.toString());
          return Promise.reject(new MaaSError(`Error creating Subscription: ${_err}`, 500));
        });
    })
    .catch(_error => {
      return Promise.reject(new MaaSError(`Error fetching Subscription: ${_error}`, 500));
    });
}

function setActivePlan(event) {
  let oldLevel;
  let oldBalance;
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
  return Profile.exists(event.identityId)
    .then(exist => {
      if (exist === false) { // False if not existed
        return Promise.reject(new MaaSError('User Not Existed', 404));
      }
      return Promise.resolve();
    })
    .then( _ => {
      return Subscriptions.getUserSubscription(event.identityId)
        .then( _ => {
          // update chargebee with the plan,
          // webhook will specify (skipUpdate)
          if (!event.skipUpdate) {
            return Subscriptions.updatePlan(event.identityId, event.planId, event.promoCode);
          }
          return Promise.resolve({});
        })
        .catch( _error => {
          // check if the error was a 404
          let reason = '';
          if (_error.response) {
            reason = JSON.stringify(_error.response, null, 2);
          }
          console.info(`Subscription error ${_error}, ${reason}`);
          if (_error.statusCode === 404) {
            console.info('Running createUser');
            return createChargebeeUser(event);
          }
          return Promise.reject(new MaaSError(`Error requesting Subscription: ${_error}`, 500));
        });
    })
    .then( _ => Profile.retrieve(event.identityId, 'balance,planLevel'))
    .then(response => { // Then retrieve plan information
      oldBalance = response.balance;
      oldLevel = response.planLevel;
      return bus.call('MaaS-store-single-package', {
        id: event.planId,
        type: 'plan',
      });
    })
    .then(newPlan => { // Then update user profile with new plan information with new balances
      console.info('New pointGrant: ', newPlan.pointGrant);
      console.info('Old balance: ', oldBalance);
      console.info('Old level: ', oldLevel);
      console.info('New level: ', newPlan.level);
      console.info('Point Tiers are', newPlan.tiers);
      let newBalance = oldBalance;
      if (newPlan.level > 0 && (newPlan.level > oldLevel) && (newPlan.level < newPlan.tiers.length)) {
        // handle upgrade
        const slices = newPlan.tiers.slice(oldLevel + 1, newPlan.level + 1); // slice the array with tiers from zero
        for (const level of slices) {
          newBalance += level;
        }
        console.info('New tier grant', newBalance);
      } else if (newPlan.level === oldLevel) {
        return Promise.resolve( { message: 'Old plan is already on the same level' } );
      } else {
        // this was a downgrade
        if (newBalance > newPlan.pointGrant) {
          newBalance = newPlan.pointGrant;
        }
        console.info('Downgrade: points', newBalance);
      }
      const params = {
        plans: [newPlan],
        balance: newBalance,
        planLevel: newPlan.level,
      };

      return Profile.update(params);
    });
}

module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => setActivePlan(event))
    .then(profile => {
      Database.cleanup()
        .then(() => callback(null, profile));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
