'use strict';

const mgr = require('../../lib/subscription-manager');

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

  require('./profile-payment-put/index.js')(testUserIdentity);
  require('./profile-payment-get/index.js')(testUserIdentity);
  require('./profile-manage/index.js')(testUserIdentity);
  require('./profile-webhook/index.js')(testUserIdentity);
});
