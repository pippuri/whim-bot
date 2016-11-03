'use strict';

const Profile = require('../../../lib/business-objects/Profile');
const Subscription = require('../../../lib/subscription-manager');

const WHIM_DEFAULT = process.env.DEFAULT_WHIM_PLAN;
const NO_PROMO_CODE = undefined;
const SKIP_CHARGEBEE_UPDATE = true;
const FORCE_SUBSCRIPTION_UPDATE = true;


function handle(payload, key, defaultResponse) {
  console.info('handleCustomerEvents');
  console.info(JSON.stringify(payload));

  let profile = null;
  let identityId = null;
  switch (payload.event_type) {
    case 'customer_changed':
    case 'customer_created':
      console.info(`\t${payload.event_type}`);
      console.info(payload.content.content);

      profile = Subscription.formatUser(payload.content.content);
      identityId = profile.identityId;

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

      profile = Subscription.formatUser(payload.content.content);
      identityId = profile.identityId;
      return Profile.updateSubscription(identityId,
                                        WHIM_DEFAULT,
                                        NO_PROMO_CODE,
                                        SKIP_CHARGEBEE_UPDATE,
                                        FORCE_SUBSCRIPTION_UPDATE)
        .then(() => Profile.update(identityId, { balance: 0 }))
        .then(() => defaultResponse);

    default:
      return defaultResponse;
  }
}

module.exports = {
  handle,
};
