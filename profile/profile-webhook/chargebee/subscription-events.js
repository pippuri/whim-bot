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
  console.info('handleSubscriptionEvents');
  console.info(JSON.stringify(payload));

  const profile = Subscription.formatUser(payload.content);

  const identityId = profile.identityId;
  const activePlan = profile.plan.id;

  const transaction = new Transaction();

  switch (payload.event_type) {
    case 'subscription_created':
    case 'subscription_started':
    case 'subscription_activated':
    case 'subscription_reactivated':
      return Profile.confirmSubscription(identityId, activePlan)
        .then(oldProfile => defaultResponse);
    case 'subscription_changed':
      console.info(`\t${payload.event_type}`);
      return transaction.start()
        .then(() => transaction.meta(models.Profile.tableName, identityId))
        .then(() => Profile.updateSubscription(
          identityId,
          activePlan,
          transaction,
          NO_PROMO_CODE,
          SKIP_CHARGEBEE_UPDATE))
        .then(() => Profile.retrieve(identityId))
        .then(oldProfile => {
          // NOTE DO NOT REMOVE ALL USER BALANCE
          return Profile.update(identityId, { balance: 0 }, transaction)
            .then(updatedProfile => (updatedProfile.balance - oldProfile.balance))
            .then(balanceChange => transaction.commit(`Subscription changed from ${oldProfile.subscription.planId} to ${activePlan}.`, identityId, balanceChange))
            .then(() => defaultResponse);
        })
        .catch(error => transaction.rollback().then(() => Promise.reject(error)));

    case 'subscription_renewed':
      console.info(`\t${payload.event_type}`);
      return Profile.renewSubscription(identityId, activePlan, NO_PROMO_CODE)
        .then(() => defaultResponse);

    case 'subscription_cancelled':
    case 'subscription_deleted':
      console.info(`\t${payload.event_type}`);
      return transaction.start()
        .then(() => Profile.updateSubscription(
          identityId,
          WHIM_DEFAULT,
          transaction,
          NO_PROMO_CODE,
          SKIP_CHARGEBEE_UPDATE,
          FORCE_SUBSCRIPTION_UPDATE))
        .then(() => Profile.retrieve(identityId))
        .then(oldProfile => {
          // NOTE DO NOT REMOVE ALL USER BALANCE
          return Profile.update(identityId, { balance: 0 }, transaction)
            .then(updatedProfile => Promise.resolve(updatedProfile.balance - oldProfile.balance))
            .then(balanceChange => transaction.commit(`Subscription removed, turned back from ${oldProfile.subscription.planId} to pay-as-you-go plan; reset point balance.`, identityId, balanceChange))
            .then(() => defaultResponse);
        })
        .catch(error => transaction.rollback().then(() => Promise.reject(error)));

    case 'subscription_shipping_address_updated':
      console.info(`\t${payload.event_type}`);
      return defaultResponse;

    default:
      return defaultResponse;
  }
}

module.exports = {
  handle,
};
