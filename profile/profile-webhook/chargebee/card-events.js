'use strict';

const Profile = require('../../../lib/business-objects/Profile');
const SubscriptionManager = require('../../../lib/business-objects/SubscriptionManager');
const Transaction = require('../../../lib/business-objects/Transaction');

const PAYMENT_INFO_COMPLETION_GRANT = 300;

function handle(payload, key) {
  console.info(`[Webhook][Chargebee] handleCardEvent ${payload.event_type}`);
  console.info(JSON.stringify(payload));

  const content = payload.content;
  const customer = content.customer;
  const identityId = customer.id;
  const address = customer.billing_address || {};
  const method = customer.payment_method || SubscriptionManager.DEFAULT_PAYMENT_METHOD;
  const card = content.card;
  const custo = SubscriptionManager.fromChargebeeAddress(address, identityId, method, card);
  const xa = new Transaction(identityId);
  const newProfile = { paymentMethod: custo.paymentMethod };

  // card_added, card_updated and card_expiry_reminder will result in a valid flag of `true`
  // card_expired and card_deleted will result in a valid flag of `false`
  return xa.start()
    .then(() => Profile.retrieve(identityId))
    .then(currentProfile => {
      // Grant a 300p if the payment method became valid
      if (!currentProfile.paymentMethod.valid && newProfile.paymentMethod.valid) {
        const message = `Add ${PAYMENT_INFO_COMPLETION_GRANT}p profile completion bonus`;
        console.info(`${message} to ${identityId}`);
        xa.message = message;
        return Profile.increaseBalance(identityId, PAYMENT_INFO_COMPLETION_GRANT, xa);
      }

      return Promise.resolve();
    })
    .then(() => Profile.update(identityId, newProfile, xa))
    .then(
      () => xa.commit(),
      error => xa.rollback().then(error => Promise.reject(error))
    );
}

module.exports = {
  handle,
};
