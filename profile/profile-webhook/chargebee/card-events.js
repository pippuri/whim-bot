'use strict';

const Profile = require('../../../lib/business-objects/Profile');
const SubscriptionManager = require('../../../lib/business-objects/SubscriptionManager');
const Transaction = require('../../../lib/business-objects/Transaction');

function handle(payload, key) {
  console.info(`[Webhook][Chargebee] handleCardEvent ${payload.event_type}`);
  console.info(JSON.stringify(payload));

  const content = payload.content;
  const customer = content.customer;
  const identityId = customer.id;
  const method = customer.payment_method || SubscriptionManager.DEFAULT_PAYMENT_METHOD;
  const card = content.card || {};
  const xa = new Transaction(identityId);

  // card_added, card_updated and card_expiry_reminder will result in a valid flag of `true`
  // card_expired and card_deleted will result in a valid flag of `false`
  const paymentMethod =
    SubscriptionManager.fromChargebeePaymentMethod(method, card);
  return xa.start()
    .then(() => Profile.update(identityId, {
      paymentMethod: paymentMethod,
    }, xa))
    .then(
      () => xa.commit(),
      error => xa.rollback().then(error => Promise.reject(error))
    );
}

module.exports = {
  handle,
};
