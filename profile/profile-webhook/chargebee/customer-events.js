'use strict';

const Profile = require('../../../lib/business-objects/Profile');
const SubscriptionManager = require('../../../lib/business-objects/SubscriptionManager');
const Transaction = require('../../../lib/business-objects/Transaction');

function handle(payload, key) {
  console.info(`[Webhook][Chargebee] handleCustomerEvent ${payload.event_type}`);
  console.info(JSON.stringify(payload));

  const content = payload.content;
  const customer = content.customer;
  const identityId = customer.id;
  const address = customer.billing_address || {};
  const method = customer.paymentMethod || {};
  const custo = SubscriptionManager.fromChargebeeAddress(address, identityId, method);
  const xa = new Transaction(identityId);

  switch (payload.event_type) {
    case 'customer_changed':
    case 'customer_created':
      return Profile.update(identityId, {
        firstName: custo.firstName,
        lastName: custo.lastName,
        email: custo.email,
        country: custo.countryCode,
        city: custo.city,
        zipCode: custo.zipCode,
      });
    case 'customer_deleted':
      return xa.start()
        .then(() => Profile.changeSubscription(identityId,
          SubscriptionManager.DEFAULT_SUBSCRIPTION, xa, true))
        .then(response => xa.commit('Subscription removed, changed to default plan.'))
        .catch(error => xa.rollback().then(() => Promise.reject(error)));
    default:
      return Promise.resolve();
  }
}

module.exports = {
  handle,
};
