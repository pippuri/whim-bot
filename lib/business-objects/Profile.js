'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../models');
const SubscriptionManager = require('../../lib/business-objects/SubscriptionManager');
const utils = require('../../lib/utils');
const Transaction = require('../../lib/business-objects/Transaction');

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
      // FIXME 400 returned in multiple occasions, not just 'already exists';
      // disable until we have semantics in the error to tell the difference
      /*.catch(error => {
        if (error.code === 400) {
          console.info('Subscription manager customer found, using it as-is');
          return Promise.resolve();
        }
        console.warn('Unknown error in creating SubscriptionManager customer');
        return Promise.reject(error);
      })*/
      .then(() => {
        return SubscriptionManager.createSubscription(subscription, identityId, identityId);
          /*.catch(error => {
            if (error.code === 400) {
              console.info('SubscriptionManager subscription found, force-updating to a new subscription');
              return SubscriptionManager.updateSubscription(subscription, identityId, identityId, true, true);
            }
            console.warn('Unknown error in creating SubscriptionManager subscription');
            return Promise.reject(error);
          });*/
      });
  }

  /**
   * Create and persist new profile data.
   *
   * Note: For now, we assume the customer and user are the same. This is not
   * necessarily the case in the long term.
   * Note: For now, we assume the new subscriptions are 'fi-whim-payg'
   *
   * @param {UUID} identityId - user ID
   * @param {String} phone - user phone number
   */
  static create(identityId, phone) {
    console.info(`[Profile] Creating a new profile for identity '${identityId}'`);

    // Note: Create profile with default subscription. Rollback in case
    // SubscriptionManager fails.
    const subs = SubscriptionManager.DEFAULT_SUBSCRIPTION;
    const newProfile = {
      identityId,
      balance: 0,
      phone,
      subscription: Profile._toSubscription(subs),
      favoriteLocations: [],
    };
    const transaction = new Transaction(identityId);
    let profile;

    return transaction.start()
      .then(() => {
        return transaction.bind(models.Profile)
          .query()
          .insert(newProfile)
          .returning('*')
          .then(_profile => {
            profile = _profile;
            return Profile._createOrUpdateSubscription(identityId, phone, subs);
          });
      })
      .then(() => transaction.commit('New customer profile created.'))
      .catch(error => transaction.rollback().then(() => Promise.reject(error)))
      .then(() => {
        console.info(`[Profile] Profile '${identityId}' successfully created`);
        return utils.sanitize(profile);
      });
  }

  /**
   * Changes an existing subscription to a new one.
   * This method exists mainly to serve Chargebee callbacks.
   *
   * @param {string} identityId - The User identity to update
   * @param {string} subscription - The updated subscription
   * @param {object} transaction - The MaaS transaction to return
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

    const model = transaction ? transaction.bind(models.Profile) : models.Profile;
    return model
      .query()
      .patchAndFetchById(identityId, attributes)
      .then(profile => {
        if (!profile) {
          // Profile does not exist
          return Promise.reject(new MaaSError(`Profile '${identityId}' does not exist`, 404));
        }

        return profile;
      })
      .then(profile => utils.sanitize(profile))
      .then(profile => {
        console.info(`[Profile] Profile for '${identityId}' successfully updated: ${JSON.stringify(profile)}`);
        return profile;
      });
  }

  /**
   * Increase user balance by an amount
   *
   * @input {UUID} identityId
   * @input {Int} amount to increase, positive number
   * @input {Object} transaction
   */
  static increaseBalance(identityId, amount, transaction) {
    console.info(`[Profile] Increase balance for '${identityId}' by ${amount} points`);
    if (!amount || amount <= 0) {
      return Promise.reject(new Error('Increase value must be bigger than 0'));
    }
    const model = transaction ? transaction.bind(models.Profile) : models.Profile;
    if (transaction) {
      transaction.increaseValue(amount);
    }
    // FIXME Figure out why normal QueryBuilder doesn't support increment
    return model.$$knex('Profile')
      .increment('balance', amount)
      .where('identityId', identityId);
  }

  /**
   * Decrease user balance by an amount
   *
   * @input {UUID} identityId
   * @input {Int} amount to decrease, positive number
   * @input {Object} transaction
   */
  static decreaseBalance(identityId, amount, transaction) {
    console.info(`[Profile] Decrease balance for '${identityId}' by ${amount} points`);
    if (!amount || amount <= 0) {
      return Promise.reject(new Error('Decrease value must be bigger than 0'));
    }
    const model = transaction ? transaction.bind(models.Profile) : models.Profile;
    if (transaction) {
      transaction.decreaseValue(amount);
    }
    // FIXME Figure out why normal QueryBuilder doesn't support decrement
    return model.$$knex('Profile')
      .decrement('balance', amount)
      .where('identityId', identityId);
  }

  static addFavoriteLocation(identityId, location) {
    console.info(`[Profile] Adding favorite location '${location}' for '${identityId}'`);

    return Profile.retrieve(identityId, ['favoriteLocations'])
      .then(profile => {
        if (profile.favoriteLocations.some(item => item.name === location.name)) {
          return Promise.reject(`Favourite location '${location}' already exists`);
        }

        const favoriteLocations = profile.favoriteLocations.concat([location]);
        return Profile.update(identityId, {
          favoriteLocations: favoriteLocations,
        });
      })
      .then(profile => utils.sanitize(profile))
      .then(profile => {
        console.info(`[Profile] Favorite location for '${identityId}' successfully added`);
        // FIXME When adding favorite locations, we should return locations, not profile
        return profile;
      });
  }

  static removeFavoriteLocation(identityId, location) {
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
        });
      })
      // FIXME When removing favorite locations, we should return locations, not profile
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
