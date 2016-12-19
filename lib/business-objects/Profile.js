'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../models');
const subscriptionMgr = require('../subscription-manager');
const utils = require('../../lib/utils');

class Profile {

  /**
   * Internal mapping function to convert a ChargeBee featuer name to
   * agencyId. This is a temporary FIXME until we can restructure Chargebee plans
   *
   * @param {object} chargebeePlan - A chargebee plan to map into subscription
   */
  static _toSubscription(chargebeePlan) {
    const agencies = chargebeePlan.meta_data.feature
      .map(feature => {
        switch (feature.name) {
          case 'hsl':
            return 'HSL';
          case 'taxi':
            return 'Valopilkku';
          default:
            return null;
        }
      })
      .filter(feature => feature !== null);

    return {
      planId: chargebeePlan.id,
      agencies: agencies,
      monthlyBalance: chargebeePlan.meta_data.pointGrant,
    };
  }

  /**
   * Create and persist new profile data
   *
   * @param {UUID} identityId - user ID
   * @param {String} phone - user phone number
   */
  static create(identityId, phone) {
    console.info(`[Profile] Creating a new profile for identity '${identityId}'`);

    return Promise.all([
      Profile.exists(identityId),
      subscriptionMgr.getUserSubscription(identityId)
        .catch(error => {
          // User does not exis
          if (error.statusCode === 404) {
            return null;
          }

          throw Promise.reject(error);
        }),
    ])
      .then(responses => {
        const exists = responses[0];
        const chargebeeUser = responses[1];

        // We got a full profile already -> reject
        if (exists) {
          return Promise.reject(new MaaSError('Profile already exists', 400));
        }

        // We got an existing Chargebee profile -> return that
        if (chargebeeUser !== null) {
          console.info('Creating a new profile with an existing Chargebee user');
          return chargebeeUser;
        }

        // Create the user and find Chargebee Plans
        // FIXME Handle the case when one (but not both calls fail)
        return subscriptionMgr.createUserSubscription(identityId,
          process.env.DEFAULT_WHIM_PLAN, { phone: phone });
      })
      .then(chargebeeUser => {
        return subscriptionMgr.getPlanById(chargebeeUser.plan.id)
          .catch(error => {
            console.warn(`Error in fetching Chargebee plan: '${JSON.stringify(error, null, 2)}'`);
            const message = `Error in fetching Chargebee plan '${chargebeeUser.plan.id}'`;
            return Promise.reject(new MaaSError(message, 500));
          })
          .then(response => {
            const subscription = Profile._toSubscription(response.plan);
            const profile = {
              identityId,
              balance: subscription.monthlyBalance,
              phone,
              subscription: subscription,
              favoriteLocations: [],
            };
            console.info(`[Profile] Creating profile ${JSON.stringify(profile)}`);

            return models.Profile.query()
              .insert(profile)
              .returning('*');
          });
      })
      .then(profile => utils.sanitize(profile))
      .then(profile => {
        console.info(`[Profile] Profile '${identityId}' successfully created`);
        return profile;
      });
  }

  /**
   * Changes an existing subscription to a new one.
   * This method exists mainly to serve Chargebee callbacks.
   *
   * @param {string} identityId - The User identity to update
   * @param {string} planId - The Chargebee plan name
   * @param {object} transaction - The MaaS transaction to return
   * @param {boolean} [force=true] - Force subscription update, no matter which it is
   * @return {Promise} resolving to updated Profile, or reject with Error
   */
  static changeSubscription(identityId, planId, transaction, force) {
    console.info(`[Profile] Set new subscription plan '${planId}' for identity '${identityId}'`);

    // Set the defaults
    force = !!force;

    let profile;
    let balanceChange;

    return Profile.retrieve(identityId)
      .then(_profile => (profile = _profile))
      .then(() => subscriptionMgr.getPlanById(planId))
      .then(plan => {
        if (profile.subscription.planId === planId && !force) {
          return Promise.reject(new MaaSError(`New planId '${planId}' equals the old planId`, 400));
        }

        // Parse the relevant bits from the plan
        const newSubscription = Profile._toSubscription(plan.plan);
        const newBalance = newSubscription.monthlyBalance;
        balanceChange = newBalance - profile.balance;
        const update = { subscription: newSubscription, balance: newBalance };

        console.info(`Change plan from '${profile.planId}' to '${planId}'`);
        console.info(`Change balance from ${profile.balance} to ${newBalance}`);

        return transaction.meta('planId', planId)
          .then(() => Profile.update(identityId, update, transaction));
      })
      .then(response => {
        console.info(`[Profile] Subscription plan '${planId}' updated for identity '${identityId}'`);
        return {
          profile: profile,
          balanceChange: balanceChange,
        };
      });
  }

  /**
   * Issue a change to subscription. Note: This does not change the
   * database as-is, but merely calls Chargebee to change the subscription.
   * The actual update to database is done as part of the Chargebee callback.
   *
   * @param {string} identityId - The User identity to order plan change
   * @param {string} planId - The Chargebee plan name
   * @param {object} transaction - The MaaS transaction to return
   * @param {string} [promoCode] - The optional promotion code
   * @return {Promise} resolving to updated Profile, or reject with Error
   */
  static issueSubscriptionChange(identityId, planId, transaction, promoCode) {
    console.info(`[Profile] Issue subscription change to'${planId}' for identity '${identityId}'`);

    let profile;
    return Profile.retrieve(identityId)
      .then(_profile => {
        profile = _profile;

        if (profile.subscription.planId === planId) {
          return Promise.reject(new MaaSError(`New planId '${planId}' equals the old planId`, 400));
        }

        return Promise.all([
          subscriptionMgr.getPlanById(profile.subscription.planId),
          subscriptionMgr.getPlanById(planId),
        ]);
      })
      .then(responses => {
        const oldPlan = responses[0].plan;
        const newPlan = responses[1].plan;

        // Do the decision on prorating
        const priceDiff = newPlan.price - oldPlan.price;
        const prorate = priceDiff > 0;
        // Update the payment term also in case of an upgrade
        const forceTerm = prorate;

        console.info(`Update to '${identityId}' plan '${planId}, prorate='${prorate}', promoCode='${promoCode}'`);
        return subscriptionMgr.updatePlan(identityId, planId, { promoCode: promoCode, prorate: prorate, updateTerm: forceTerm });
      })
      .then(response => {
        console.info(`[Profile] Subscription plan '${planId}' updated for identity '${identityId}' on Chargebee`);
        return response;
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
        console.info(`[Profile] Profile for '${identityId}' successfully updated`);
        return profile;
      });
  }

  /**
   * Increase user balance by an amount
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
    // FIXME Figure out why normal QueryBuilder doesn't support increment
    return model.$$knex('Profile')
      .increment('balance', amount)
      .where('identityId', identityId);
  }

  /**
   * Decrease user balance by an amount
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
