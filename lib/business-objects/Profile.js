'use strict';

const AWS = require('aws-sdk');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../models');
const SubscriptionManager = require('../../lib/business-objects/SubscriptionManager');
const utils = require('../../lib/utils');
const promiseUtils = require('../../lib/utils/promise');
const Transaction = require('../../lib/business-objects/Transaction');

const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });
const iot = new AWS.Iot({ region: process.env.AWS_REGION });

/**
 * Delete the user's IoT Thing
 */
function deleteUserIotThing(identityId) {
  const thingName = identityId.replace(/:/, '-');
  console.info('Deleting user IoT thing', identityId, thingName);

  // Detach the cognito policy from the IoT thing
  const detachPrincipalPolicyAsync = promiseUtils.promisify(iot.detachPrincipalPolicy, iot);
  return detachPrincipalPolicyAsync({
    policyName: 'DefaultCognitoPolicy',
    principal: identityId,
  })
  .then(response => {
    console.info('DetachThingPrincipalPolicy response:', response);

    // Detach the cognito identity from the thing
    const detachThingPrincipalAsync = promiseUtils.promisify(iot.detachThingPrincipal, iot);
    return detachThingPrincipalAsync({
      principal: identityId,
      thingName: thingName,
    });
  })
  .then(response => {
    console.info('DetachThingPrincipal response:', response);

    // Delete the IoT thing
    const deleteThingAsync = promiseUtils.promisify(iot.deleteThing, iot);
    return deleteThingAsync({
      thingName: thingName,
    });
  })
  .then(response => {
    console.info('Deleted IoT thing:', response);
  });
}

/// Delete the user's Cognito profile
function deleteUserCognitoProfile(identityId) {
  console.info('Deleting user Cognito profile', identityId);
  const deleteDatasetAsync = promiseUtils.promisify(cognitoSync.deleteDataset, cognitoSync);
  return deleteDatasetAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: identityId,
    DatasetName: process.env.COGNITO_PROFILE_DATASET,
  })
  .then(response => {
    console.info('Deleted Cognito profile:', response);
  });
}


class Profile {
  /**
   * Internal mapping function to convert a ChargeBee subscription items
   * to something that maps with agencyIds.
   *
   * This is a temporary FIXME until we we have our products API.
   *
   * @param {object} subscription - A mapping from Chargebee to our format
   */
  static _toSubscription(subscription) {
    // TODO Until we have products API, we simply assume everything else
    // than 'payg' includes HSL agency, and extra addons do nothing.
    const defaultPlan = SubscriptionManager.DEFAULT_SUBSCRIPTION.plan.id;
    const agencies = subscription.plan.id === defaultPlan ? [] : ['HSL'];
    return {
      planId: subscription.plan.id,
      agencies,
    };
  }

  /**
   * A helper function for creating SubscriptionManager customer and
   * subscription.
   *
   * @param {string} identityId - the user identity to create
   * @param {string} phone - the phone number of the user
   * @param {object} subscription - the subscription to use
   */
  static _createOrUpdateSubscription(identityId, phone, subscription) {
    const customer = { identityId, phone };

    // Try to create a customer. If exists, use it as-is.
    return SubscriptionManager.createCustomer(customer)
      // If we got a 409 (conflict), the customer already exists; then just return it as-is
      .catch(error => {
        if (error.code === 409) {
          console.info('Subscription manager customer found, using it as-is');
          return SubscriptionManager.retrieveCustomer(identityId);
        }
        console.warn('Unknown error in creating SubscriptionManager customer');
        return Promise.reject(error);
      })
      .then(() => {
        return SubscriptionManager.createSubscription(subscription, identityId, identityId)
          .catch(error => {
            if (error.code === 409) {
              console.info('SubscriptionManager subscription found, using that as-is');
              return SubscriptionManager.retrieveSubscriptionByUserId(identityId);
            }
            console.warn('Unknown error in creating SubscriptionManager subscription');
            return Promise.reject(error);
          });
      })
      .then(subscription => SubscriptionManager.annotateSubscription(subscription));
  }

  /**
   * Delete a profile and associated resources permanently
   *
   * @param {UUID} identityId - user ID
   */
  static delete(identityId, transaction) {
    console.info(`[Profile] Deleteing (permanently) profile for identity '${identityId}'`);

    // Fetch the profile
    return Profile.retrieve(identityId)
      .then(() => deleteUserCognitoProfile(identityId))
      .then(() => deleteUserIotThing(identityId))
      .then(() => SubscriptionManager.deleteCustomer(identityId))
      .then(() => {
        // Delete database profile
        const model = transaction.bind(models.Profile);
        return model
          .query()
          .delete()
          .where({ identityId: identityId });
      })
      .then(() => {
        console.info(`[Profile] Profile '${identityId}' successfully deleted`);
      });
  }

  /**
   * Changes an existing subscription to a new one.
   * This method exists mainly to serve Chargebee callbacks.
   *
   * Note: For now, we assume the customer and user are the same. This is not
   * necessarily the case in the long term.
   * Note: For now, we assume the new subscriptions are 'fi-whim-payg'
   *
   * @param {string} identityId - user ID
   * @param {string} phone - user phone number
   * @param {Transaction} transaction - The transaction context to use
   */
  static create(identityId, phone, transaction) {
    console.info(`[Profile] Creating a new profile for identity '${identityId}'`);

    // Note: Create profile with default subscription. Rollback in case
    // SubscriptionManager fails.
    const subs = SubscriptionManager.DEFAULT_SUBSCRIPTION;
    return Profile._createOrUpdateSubscription(identityId, phone, subs)
      .then(subscription => {
        const newProfile = {
          identityId,
          balance: subscription.points,
          phone,
          subscription: Profile._toSubscription(subscription),
          paymentMethod: SubscriptionManager.DEFAULT_PAYMENT_METHOD,
          favoriteLocations: [],
        };

        transaction.type = Transaction.types.BALANCE_SET;
        transaction.value = subscription.points;
        return transaction.bind(models.Profile)
        .query()
        .insert(newProfile)
        .returning('*');
      })
      .then(profile => {
        console.info(`[Profile] Profile '${identityId}' successfully created`);
        return utils.sanitize(profile);
      });
  }

  /**
   * Changes an existing subscription to a new one.
   * This method exists mainly to serve Chargebee callbacks.
   *
   * @param {string} identityId - The User identity to update
   * @param {object} subscription - The updated subscription
   * @param {Transaction} transaction - The MaaS transaction context
   * @param {boolean} [reset=true] - Whether or not to reset balance
   * @return {Promise} resolving to updated Profile, or reject with Error
   */
  static changeSubscription(identityId, subscription, transaction, reset) {
    console.info(`[Profile] Set new subscription '${JSON.stringify(subscription)}' for identity '${identityId}'`);

    // TODO Figure out how to tell difference between just one new add-on or
    // whole subscription being updated (to prevent point resetting)
    const subs = Profile._toSubscription(subscription);
    const planId = subscription.plan.id;

    transaction.meta('planId', planId);
    return SubscriptionManager.findRawSubscriptionOption(planId)
      .then(option => {
        const update = { subscription: subs };

        if (reset) {
          const newBalance = option.points;
          console.info(`[Profile] Reset balance to ${newBalance}`);
          update.balance = newBalance;
          transaction.type = Transaction.types.BALANCE_SET;
          transaction.value = newBalance;
        }
        return Profile.update(identityId, update, transaction);
      })
      .then(response => {
        console.info(`[Profile] Subscription ${JSON.stringify(subscription)} updated for identity '${identityId}'`);
        return subscription;
      });
  }

  static retrieve(identityId, attributes) {
    console.info(`[Profile] Retrieving profile for identity '${identityId}'`);

    return models.Profile
      .query()
      .findById(identityId)
      .then(profile => {
        if (!profile) {
          // Profile does not exist
          return Promise.reject(new MaaSError(`Profile '${identityId}' does not exist`, 404));
        }

        attributes = attributes || Object.keys(profile);
        const subset = attributes.reduce((subset, attribute) => {
          subset[attribute] = profile[attribute];
          return subset;
        }, { identityId: profile.identityId });

        console.info(`[Profile] Profile for '${identityId}' successfully retrieved`);
        return utils.sanitize(subset);
      });
  }

  /*
   * Update user profile by attributes
   *
   * @static
   * @param {Array[String]} attributes - attributes to retrieve, will fetch all if not specified
   * @param {object} [transaction] - Optional objection transaction object. If input all database operations
   * are bound to this transaction. Whoever calls this update method,
   * must then commit or rollback the transaction!
   *
   * @return {Object} profile - updatedProfile
   */
  static update(identityId, attributes, transaction) {
    console.info(`[Profile] Updating profile for identity '${identityId}': '${JSON.stringify(attributes)}'`);

    // If no attributes are passed in, it's a NOOP
    if (utils.isEmpty(attributes)) {
      console.info('No attributes provided. Skipping update.');
      return Profile.retrieve(identityId);
    }

    // ensure no negative balance can be saved
    if ('balance' in attributes && attributes.balance < 0) {
      return Promise.reject(new MaaSError(`Cannot save negative balance of ${attributes.balance} for profile '${identityId}'`, 400));
    }

    return transaction.bind(models.Profile)
      .query()
      .patchAndFetchById(identityId, attributes)
      .then(profile => {
        if (!profile) {
          // Profile does not exist
          return Promise.reject(new MaaSError(`Profile '${identityId}' does not exist`, 404));
        }

        return profile;
      })
      .then(profile => {
        console.info(`[Profile] Profile for '${identityId}' successfully updated: ${JSON.stringify(profile)}`);
        return utils.sanitize(profile);
      });
  }

  /**
   * Increase user balance by an amount
   *
   * @input {string} identityId - the user identity id
   * @input {number} amount - how much to increase, positive integer
   * @input {Transaction} transaction - MaaS transaction context
   */
  static increaseBalance(identityId, amount, transaction) {
    console.info(`[Profile] Increase balance for '${identityId}' by ${amount} points`);

    if (!amount || amount <= 0) {
      return Promise.reject(new Error('Increase value must be bigger than 0'));
    }

    transaction.increaseValue(amount);
    // FIXME Figure out why normal QueryBuilder doesn't support increment
    return transaction.bind(models.Profile)
      .$$knex('Profile')
      .increment('balance', amount)
      .where('identityId', identityId);
  }

  /**
   * Decrease user balance by an amount
   *
   * @input {string} identityId
   * @input {number} amount - how much to decrease, positive integer
   * @input {Object} transaction
   */
  static decreaseBalance(identityId, amount, transaction) {
    console.info(`[Profile] Decrease balance for '${identityId}' by ${amount} points`);

    if (!amount || amount <= 0) {
      return Promise.reject(new Error('Decrease value must be bigger than 0'));
    }

    transaction.decreaseValue(amount);
    return transaction.bind(models.Profile)
      .query()
      .select('balance')
      .where('identityId', identityId)
      .then(result => {
        if (result[0] && result[0].balance - amount < 0) {
          return Promise.reject(new MaaSError(`No enough funds to withdraw ${amount} points`, 400));
        }
        return Promise.resolve();
      })
      .then(() => {
        return transaction.bind(models.Profile)
          // FIXME Figure out why normal QueryBuilder doesn't support decrement
          .$$knex('Profile')
          .decrement('balance', amount)
          .where('identityId', identityId);
      });
  }

  static addFavoriteLocation(identityId, location, transaction) {
    console.info(`[Profile] Adding favorite location '${location}' for '${identityId}'`);

    return Profile.retrieve(identityId, ['favoriteLocations'])
      .then(profile => {
        if (profile.favoriteLocations.some(item => item.name === location.name)) {
          return Promise.reject(`Favourite location '${location}' already exists`);
        }

        const favoriteLocations = profile.favoriteLocations.concat([location]);
        return Profile.update(identityId, {
          favoriteLocations: favoriteLocations,
        }, transaction);
      })
      .then(profile => utils.sanitize(profile))
      .then(profile => {
        console.info(`[Profile] Favorite location for '${identityId}' successfully added`);
        // FIXME When adding favorite locations, return locations, not profile
        return profile;
      });
  }

  static removeFavoriteLocation(identityId, location, transaction) {
    console.info(`[Profile] Removing favorite location '${location}' for '${identityId}'`);

    return Profile.retrieve(identityId, ['favoriteLocations'])
      .then(profile => {
        if (profile.favoriteLocations.every(item => item.name !== location)) {
          return Promise.reject(`Favorite location '${location}' does not exist.`);
        }

        const favoriteLocations = profile.favoriteLocations.filter(item => {
          return item.name !== location;
        });
        return Profile.update(identityId, {
          favoriteLocations: favoriteLocations,
        }, transaction);
      })
      // FIXME When removing favorite locations, return locations, not profile
      .then(profile => utils.sanitize(profile))
      .then(profile => {
        console.info(`[Profile] Favorite location for '${identityId}' successfully removed`);
        return profile;
      });
  }

  static exists(identityId) {
    return models.Profile.query()
      .select('identityId')
      .where('identityId', '=', identityId)
      .then(profiles => {
        return profiles.length > 0;
      });
  }
}

module.exports = Profile;
