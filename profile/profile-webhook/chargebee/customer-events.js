'use strict';

const Profile = require('../../../lib/business-objects/Profile');
const Subscription = require('../../../lib/subscription-manager');
const Transaction = require('../../../lib/business-objects/Transaction');

const WHIM_DEFAULT = process.env.DEFAULT_WHIM_PLAN;

function handle(payload, key, defaultResponse) {
  console.info(`[Webhook][Chargebee] handleCustomerEvent ${payload.event_type}`);
  console.info(JSON.stringify(payload));

  const profile = Subscription.formatUser(payload.content);
  const identityId = profile.identityId;

  const transaction = new Transaction(identityId);

  switch (payload.event_type) {
    case 'customer_changed':
    case 'customer_created':
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
      return transaction.start()
        .then(() => Profile.changeSubscription(identityId, WHIM_DEFAULT, transaction, true))
        .then(response => transaction.commit(`Subscription removed, changed to ${WHIM_DEFAULT}; reset balance to 0`))
        .then(() => defaultResponse)
        .catch(error => transaction.rollback().then(() => Promise.reject(error)));

    default:
      return defaultResponse;
  }
}

module.exports = {
  handle,
};
