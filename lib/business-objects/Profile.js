'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const subscriptionMgr = require('../subscription-manager');
const ProfileDAO = require('../models/Profile');
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

    return Profile.exists(identityId)
      .then(exists => {
        if (exists) {
          return Promise.reject(new MaaSError('Profile already exists', 400));
        }

        // Create the user and find Chargebee Plans
        // FIXME Handle the case when one (but not both calls fail)
        return subscriptionMgr.createUser(identityId,
          process.env.DEFAULT_WHIM_PLAN, { phone: phone });
      })
      .then(chargebeeUser => {
        return subscriptionMgr.getPlanById(chargebeeUser.plan.id)
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

            return ProfileDAO.query()
              .insert(profile)
              .returning('*');
          });
      })
      .then(profile => utils.removeNulls(profile))
      .then(profile => {
        console.info(`[Profile] Profile '${identityId}' successfully created`);
        return profile;
      });
  }

  static updateSubscription(identityId, planId, promoCode, skipUpdate) {
    console.info(`[Profile] Set new subscription plan '${planId}' for identity '${identityId}'`);

    let profile;
    let chargebeeUpdate;
    let oldPlan;
    let newPlan;
    return Profile.retrieve(identityId)
      .then(_profile => (profile = _profile))
      .then(() => {
        // If no change in plans, we should not have called this method in the first place
        if (profile.subscription.planId === planId) {
          return Promise.reject(new MaaSError(`New planId '${planId}' equals the old planId`, 400));
        }

        return Promise.all([
          subscriptionMgr.getPlanById(profile.subscription.planId),
          subscriptionMgr.getPlanById(planId),
        ]);
      })
      .then(responses => {
        oldPlan = responses[0].plan;
        newPlan = responses[1].plan;

        if (!skipUpdate) {
          console.info('Skipping Chargebee plan update.');
          return Promise.resolve();
        }

        // Do the decision on prorating
        const priceDiff = newPlan.price - oldPlan.price;
        const prorate = priceDiff > 0;

        console.info(`Update to '${identityId}' plan '${planId}, prorate='${prorate}', promoCode='$promoCode'`);
        return subscriptionMgr.updatePlan(identityId, planId, { promoCode: promoCode, prorate: prorate });
      })
      .then(_update => (chargebeeUpdate = _update))
      .then(response => {
        const newSub = Profile._toSubscription(newPlan);
        const oldSub = profile.subscription;

        // Balance adjustment logic: Keep all the old points - in case of
        // downgrade, they are handled in the end of the month. For upgrades,
        // points should be adjusted right away.
        const diff = newSub.monthlyBalance - oldSub.monthlyBalance;
        const newBalance = Math.max(0, profile.balance + diff);

        console.info(`Change plan from '${oldSub.id}' to '${newSub.id}'`);
        console.info(`Change balance from ${profile.balance} to ${newBalance}`);

        // FIXME It feels dirty to get Chargebee user data like this
        const params = {
          subscription: newSub,
          balance: newBalance,
        };

        let optional = {};
        if (typeof chargebeeUpdate !== typeof undefined) {
          optional = {
            firstName: chargebeeUpdate.customer.first_name,
            lastName: chargebeeUpdate.customer.last_name,
            email: chargebeeUpdate.customer.email,
            city: chargebeeUpdate.customer.billing_address.city,
            country: chargebeeUpdate.customer.billing_address.country,
            zipCode: chargebeeUpdate.customer.billing_address.zip,
          };
        }
        const update = Object.assign({}, params, optional);
        return Profile.update(identityId, update);
      })
      .then(response => {
        console.info(`[Profile] Subscription plan '${planId}' updated for identity '${identityId}'`);
        return response;
      });
  }

  static retrieve(identityId, attributes) {
    console.info(`[Profile] Retrieving profile for identity '${identityId}'`);

    return ProfileDAO.query().findById(identityId)
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
        return utils.removeNulls(subset);
      });
  }

  static update(identityId, attributes) {
    console.info(`[Profile] Updating profile for identity '${identityId}': '${JSON.stringify(attributes)}'`);

    return ProfileDAO.query().patchAndFetchById(identityId, attributes)
      .then(profile => {
        if (!profile) {
          // Profile does not exist
          return Promise.reject(new MaaSError(`Profile '${identityId}' does not exist`, 404));
        }

        return profile;
      })
      .then(profile => utils.removeNulls(profile))
      .then(profile => {
        console.info(`[Profile] Profile for '${identityId}' successfully updated`);
        return profile;
      });
  }

  static addFavoriteLocation(identityId, location) {
    console.info(`[Profile] Adding favorite location '${location}' for '${identityId}'`);

    return Profile.retrieve(identityId, ['favoriteLocations'])
      .then(profile => {
        if (profile.favoriteLocations.some(item => item.name === location.name)) {
          return Promise.reject(`Favourite location '${location}' already exists`);
        }

        profile.favoriteLocations.push(location);
        const favoriteLocations = {
          favoriteLocations: profile.favoriteLocations,
        };
        return Profile.query().patchAndFetchById(identityId, favoriteLocations);
      })
      .then(profile => utils.removeNulls(profile))
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
      .then(profile => utils.removeNulls(profile))
      .then(profile => {
        console.info(`[Profile] Favorite location for '${identityId}' successfully removed`);
        return profile;
      });
  }

  static exists(identityId) {
    return ProfileDAO.query()
      .select('identityId')
      .where('identityId', '=', identityId)
      .then(profiles => {
        return profiles.length > 0;
      });
  }
}

module.exports = Profile;
