'use strict';

const Promise = require('bluebird');
const Profile = require('../../../lib/business-objects/Profile');
const SubscriptionManager = require('../../../lib/business-objects/SubscriptionManager');
const Transaction = require('../../../lib/business-objects/Transaction');

function handle(payload, key, defaultResponse) {
  console.info(`[Webhook][Chargebee] handleSubscriptionEvent ${payload.event_type}`);
  console.info(JSON.stringify(payload));

  const cbSubs = payload.content.subscription;
  let subs = SubscriptionManager.fromChargebeeSubscription(cbSubs);
  const invoice = payload.content.invoice;
  const invoicedChanges = (invoice) ?
    SubscriptionManager.fromChargebeeEstimate(invoice).lineItems : [];
  const identityId = cbSubs.id;
  let message;
  let user;

  switch (payload.event_type) {
    case 'subscription_created':
    case 'subscription_started':
    case 'subscription_activated':
    case 'subscription_reactivated':
      // Reactivate the subscription by just changing to the new plan
      message = `Subscription activated to ${JSON.stringify(subs)}`;
      break;
    case 'subscription_changed':
      // Change the subscription by changing to the new plan
      message = `Subscription changed to ${JSON.stringify(subs)}`;
      break;
    case 'subscription_renewed':
      // Renew the subscription by changing to the new plan
      message = `Subscription renewed to ${JSON.stringify(subs)}`;
      break;
    case 'subscription_cancelled':
    case 'subscription_deleted':
      // Cancel/delete the subscription by setting to the default plan (payg)
      message = 'Subscription cancelled, plan changed to default; reset point balance.';
      subs = SubscriptionManager.DEFAULT_SUBSCRIPTION;
      break;
    case 'subscription_shipping_address_updated':
      // Return early, because we do not change subscription - we change the profile
      user = SubscriptionManager.fromChargebeeAddress(cbSubs.shipping_address, identityId);
      return Profile.update(identityId, {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        country: user.country,
        city: user.city,
        zipCode: user.zip,
      });
    default:
      console.info(`[Webhook][Chargebee] Unhandled Chargebee callback: ${payload.event_type}`);
      return Promise.resolve();
  }

  // Find the delta from invoice line items. If invoiced items are
  // non-recurring, they are not shown in the subscription object. For now, only
  // handle top-up as one such special case, e.g. balance change.
  // Also determine whether or not to change balance from the invoiced plan
  // (plan changes reset balance).
  const xa = new Transaction(identityId);
  const topup = invoicedChanges.find(i => i.id === SubscriptionManager.TOPUP_ID);
  // FIXME there is not always an invoice for plan change (e.g. case renewed);
  // for now we have no way to determine whether or not reset the balance
  const resetBalance = true; // !!invoicedChanges.find(i => i.type === 'plan');

  return xa.start()
    .then(() => {
      const promises = [];
      if (topup) {
        message = `Top-up balance by ${JSON.stringify(topup.quantity)} points`;
        promises.push(Profile.increaseBalance(identityId, topup.quantity, xa));
      }
      // If topup was the only change, no need to update the subscription
      if (!topup || (topup && invoicedChanges.length !== 1)) {
        promises.push(Profile.changeSubscription(identityId, subs, xa, resetBalance));
      } else {
        console.info('Skipping subscription update, no invoicable changes found.');
      }

      return Promise.all(promises);
    })
    .then(response => {
      return xa.commit(message);
    })
    .catch(error => xa.rollback().then(() => Promise.reject(error)));
}

module.exports = {
  handle,
};
