'use strict';

const mgr = require('../../lib/subscription-manager');

// Extra headers to pass to request-promise-lite during tests;
// this header supresses the triggering of webhooks by Chargebee
const EXTRA_REQUEST_OPTIONS = JSON.stringify({
  headers: {
    'chargebee-event-webhook': 'all-disabled',
  },
});

describe('profile tools', () => {
  const testUserIdentity = 'eu-west-1:00000000-cafe-cafe-cafe-000000000005';
  const creditCardData = {
    firstName: 'Chargebee-Test',
    lastName: 'Do not change in tests',
    email: 'tech@maas.fi',
    zip: '02270',
    city: 'Espoo',
    country: 'FI',
    card: {
      number: '4242424242424242',
      cvv: '111',
      expiryMonth: '01',
      expiryYear: '2020',
    },
  };

  before(() => {
    // Set the extra options for request-promise-lite in the environment
    process.env.RPL_DEFAULTS = EXTRA_REQUEST_OPTIONS;

    // Try to cleanup Chargebee identity - fetch, delete if exists (!404),
    // and then create a new one. Deletion may fail with 400 if the Profile
    // is already scheduled for deletion.
    return mgr.getUserSubscription(testUserIdentity)
      .catch(error => {
        if (error.statusCode === 404) {
          return mgr.createUserSubscription(
            testUserIdentity, 'fi-whim-payg', { phone: '+358555666' });
        }

        return Promise.reject(error);
      })
      .then(mgr.updateUserCreditCard(testUserIdentity, creditCardData))
      .catch(error => {
        console.log('Caught an exception:', error.message);
        console.log(error.response.toString());
        console.log(error.stack);
        throw error;
      });
  });

  after(() => {
    // Clear the extra options for request-promise-lite in the environment
    process.env.RPL_DEFAULTS = '{}';
  });

  require('./profile-card-update/index.js')(testUserIdentity);
  require('./profile-manage/index.js')(testUserIdentity);
  require('./profile-card-get/index.js')(testUserIdentity);
  require('./profile-webhook/index.js')(testUserIdentity);
});
