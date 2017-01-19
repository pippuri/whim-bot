'use strict';

const Profile = require('../../../lib/business-objects/Profile');
const Subscription = require('../../../lib/subscription-manager');


function handle(payload, key, defaultResponse) {
  console.info(`[Webhook][Chargebee] handleCardEvent ${payload.event_type}`);
  console.info(JSON.stringify(payload));

  const profile = Subscription.formatUser(payload.content);
  const identityId = profile.identityId;

  switch (payload.event_type) {
    case 'card_added':
    case 'card_updated':
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

    default:
      return defaultResponse;
  }
}

module.exports = {
  handle,
};
