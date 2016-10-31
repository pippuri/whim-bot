'use strict';

const Profile = require('../../../lib/business-objects/Profile');
const Subscription = require('../../../lib/subscription-manager');
const lib = require('./lib');


function handle(payload, key, defaultResponse) {
    console.log('handleCustomerEvents');
    switch (payload.event_type) {
      case 'customer_changed':
        console.log('\tcustomer_changed');
        console.log(payload.content.content);

        const profile = Subscription.formatUser(payload.content.content);
        const identityId = profile.identityId;

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
