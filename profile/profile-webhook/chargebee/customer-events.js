'use strict';

const models = require('../../../lib/models');
const Profile = require('../../../lib/business-objects/Profile');
const Subscription = require('../../../lib/subscription-manager');
const Transaction = require('../../../lib/business-objects/Transaction');

const WHIM_DEFAULT = process.env.DEFAULT_WHIM_PLAN;
const NO_PROMO_CODE = undefined;
const SKIP_CHARGEBEE_UPDATE = true;
const FORCE_SUBSCRIPTION_UPDATE = true;

function handle(payload, key, defaultResponse) {
  console.info('handleCustomerEvents');
  console.info(JSON.stringify(payload));

  const profile = Subscription.formatUser(payload.content);
  const identityId = profile.identityId;

  const transaction = new Transaction();

  switch (payload.event_type) {
    case 'customer_changed':
    case 'customer_created':
      console.info(`\t${payload.event_type}`);
      console.info(payload.content.content);

      // Make sure we have at least something
      if (!profile.hasOwnProperty('address')) {
        profile.address = {};
      }

      return Profile.update(identityId, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        country: profile.address.country,
        city: profile.address.city,
        zipCode: profile.address.zip,
      })
      .then(profile => {
        return defaultResponse;
      });

    case 'customer_deleted':
      //[XXX: the customer is reset to payg, but not marked as 'deleted']
      console.info(`\t${payload.event_type}`);
      console.info(payload.content.content);

      return transaction.start()
        .then(() => transaction.bind(models.Profile))
        .then(() => transaction.associate(models.Profile.tableName, identityId))
        .then(() => Profile.updateSubscription(
          identityId,
          transaction.self,
          WHIM_DEFAULT,
          NO_PROMO_CODE,
          SKIP_CHARGEBEE_UPDATE,
          FORCE_SUBSCRIPTION_UPDATE))
          .then(() => Profile.retrieve(identityId))
          // NOTE DO NOT REMOVE ALL USER BALANCE
          .then(oldProfile => {
            return Profile.update(identityId, { balance: 0 }, transaction.self)
              .then(updatedProfile => Promise.resolve(updatedProfile.balance - oldProfile.balance))
              .then(balanceChange => transaction.commit(`Subscription removed, turned back from ${oldProfile.subscription.planId} to Pay-as-you-go subscription plan`, identityId, balanceChange))
              .then(() => defaultResponse);
          })
          .catch(error => transaction.rollback(error.message).then(() => Promise.reject(error)));

    default:
      return defaultResponse;
  }
}

module.exports = {
  handle,
};
