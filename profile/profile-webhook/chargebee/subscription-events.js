'use strict';

const Promise = require('bluebird');
const models = require('../../../lib/models');
const Profile = require('../../../lib/business-objects/Profile');
const Subscription = require('../../../lib/subscription-manager');
const Transaction = require('../../../lib/business-objects/Transaction');

const WHIM_DEFAULT = process.env.DEFAULT_WHIM_PLAN;

function handle(payload, key, defaultResponse) {
  console.info('handleSubscriptionEvent');
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
      return transaction.start()
        .then(() => transaction.meta(models.Profile.tableName, identityId))
        .then(() => Profile.changeSubscription(identityId, activePlan, transaction))
        .then(balanceChange => transaction.commit(`Subscription changed to ${activePlan}.`, identityId, balanceChange))
        .then(() => defaultResponse)
        .catch(error => transaction.rollback().then(() => Promise.reject(error)));
    case 'subscription_renewed':
      return Profile.renewSubscription(identityId, activePlan)
        .then(() => defaultResponse);
    case 'subscription_cancelled':
    case 'subscription_deleted':
      return transaction.start()
        .then(() => Profile.updateSubscription(identityId, WHIM_DEFAULT, transaction))
        .then(balanceChange => transaction.commit(`Subscription removed, plan changed to ${WHIM_DEFAULT}; reset point balance.`, identityId, balanceChange))
        .then(() => defaultResponse)
        .catch(error => transaction.rollback().then(() => Promise.reject(error)));
    case 'subscription_shipping_address_updated':
      console.info(`Unhandled Chargebee callback: ${payload.event_type}`);
      return defaultResponse;

    default:
      return defaultResponse;
  }
}

module.exports = {
  handle,
};
