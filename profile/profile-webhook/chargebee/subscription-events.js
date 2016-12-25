'use strict';

const Promise = require('bluebird');
const Profile = require('../../../lib/business-objects/Profile');
const Subscription = require('../../../lib/subscription-manager');
const Transaction = require('../../../lib/business-objects/Transaction');

const WHIM_DEFAULT = process.env.DEFAULT_WHIM_PLAN;

function handle(payload, key, defaultResponse) {
  console.info(`handleSubscriptionEvent ${payload.event_type}`);
  console.info(JSON.stringify(payload));

  const profile = Subscription.formatUser(payload.content);
  const identityId = profile.identityId;
  const transaction = new Transaction(identityId);
  let activePlan = profile.plan.id;
  let forceUpdate = false;
  let message;

  switch (payload.event_type) {
    case 'subscription_created':
    case 'subscription_started':
    case 'subscription_activated':
    case 'subscription_reactivated':
      // Reactivate the subscription by just changing to the new plan
      message = `Subscription activated to ${activePlan}`;
      forceUpdate = true;
      break;
    case 'subscription_changed':
      // Change the subscription by changing to the new plan
      message = `Subscription changed to ${activePlan}`;
      break;
    case 'subscription_renewed':
      // Renew the subscription by changing to the new plan
      message = `Subscription renewed to ${activePlan}`;
      forceUpdate = true;
      break;
    case 'subscription_cancelled':
    case 'subscription_deleted':
      // Cancel/delete the subscription by setting to the default plan (payg)
      activePlan = WHIM_DEFAULT;
      message = `Subscription removed, plan changed to ${WHIM_DEFAULT}; reset point balance.`;
      forceUpdate = true;
      break;
    case 'subscription_shipping_address_updated':
    default:
      console.info(`Unhandled Chargebee callback: ${payload.event_type}`);
      return defaultResponse;
  }

  return transaction.start()
    .then(() => Profile.changeSubscription(identityId, activePlan, transaction, forceUpdate))
    .then(response => transaction.commit(message))
    .then(() => defaultResponse)
    .catch(error => transaction.rollback().then(() => Promise.reject(error)));
}

module.exports = {
  handle,
};
