'use strict';

const Promise = require('bluebird');
const Profile = require('../../../lib/business-objects/Profile');
const SubscriptionManager = require('../../../lib/business-objects/SubscriptionManager');
const Transaction = require('../../../lib/business-objects/Transaction');

function handle(payload, key, defaultResponse) {
  console.info(`[Webhook][Chargebee] handleSubscriptionEvent ${payload.event_type}`);
  console.info(JSON.stringify(payload));

  const cbSubs = payload.content.subscription;
  const identityId = cbSubs.id;
  const invoice = payload.content.invoice;
  const invoicedChanges = (invoice) ?
    SubscriptionManager.fromChargebeeEstimate(invoice).lineItems : [];
  let subs = SubscriptionManager.fromChargebeeSubscription(cbSubs);
  let transactionMessage;
  let transactionMeta;
  let resetBalance = true;
  //let user;

  switch (payload.event_type) {
    case 'subscription_created':
    case 'subscription_started':
    case 'subscription_activated':
    case 'subscription_reactivated':
      // Reactivate the subscription by just changing to the new plan
      transactionMessage = `Subscription activated to ${subs.plan.id}`;
      transactionMeta = JSON.stringify(subs);
      break;
    case 'subscription_changed':
      // Change the subscription by changing to the new plan
      transactionMessage = `Subscription changed to ${subs.plan.id}`;
      transactionMeta = JSON.stringify(subs);
      // Reset the balance only in case the subscription change included
      // a payment of a plan (e.g. an upgrade happened)
      if (!invoicedChanges.some(i => i.type === 'plan')) {
        resetBalance = false;
      }
      break;
    case 'subscription_renewed':
      // Renew the subscription by changing to the new plan
      transactionMessage = `Subscription renewed to ${subs.plan.id}`;
      transactionMeta = JSON.stringify(subs);
      break;
    case 'subscription_cancelled':
    case 'subscription_deleted':
      // Cancel/delete the subscription by setting to the default plan (payg)
      transactionMessage = 'Subscription cancelled, plan changed to default; reset point balance.';
      subs = SubscriptionManager.DEFAULT_SUBSCRIPTION;
      break;
    case 'subscription_shipping_address_updated':
      // Return early, because we do not change subscription - we change the profile
      // Note: We have disabled shipping address updates to user profile,
      // because we don't yet make a distinction between the user & profile.
      /*user = SubscriptionManager.fromChargebeeAddress(cbSubs.shipping_address, identityId);
      return Profile.update(identityId, {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        country: user.country,
        city: user.city,
        zipCode: user.zipCode,
      });*/
      return Promise.resolve();
    default:
      console.info(`[Webhook][Chargebee] Unhandled Chargebee callback: ${payload.event_type}`);
      return Promise.resolve();
  }

  // Note: non-recurring items are not displayed in subscription changes
  // (they can be found from invoice line items, though). For now, the
  // non-recurring items are handled in API endpoints (e.g. subscription-update)
  const xa = new Transaction(identityId);
  xa.meta('subscription', transactionMeta);
  return xa.start()
    .then(() => Profile.changeSubscription(identityId, subs, xa, resetBalance))
    .then(response => xa.commit(transactionMessage))
    .catch(error => xa.rollback().then(() => Promise.reject(error)));
}

module.exports = {
  handle,
};
