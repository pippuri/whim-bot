'use strict';

const mgr = require('../../lib/subscription-manager');

describe('profile tools', function () {
  this.timeout(20000);

  const testUserIdentity = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';
  const creditCardData = {
    firstName: 'Test',
    lastName: 'User',
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

  // Create a Chargebee profile for the test user, so that the endpoints can work
  before(() => {
    return mgr.createUserSubscription(testUserIdentity, 'fi-whim-payg', { phone: '+358555666' })
      .then(mgr.updateUserCreditCard(testUserIdentity, creditCardData))
      .catch(error => {
        console.log('Caught an exception:', error.message);
        console.log(error.response.toString());
        console.log(error.stack);
        throw error;
      });
  });

  after(() => {
    return mgr.deleteUserSubscription(testUserIdentity)
    .catch(error => {
      console.log('Caught an exception:', error.message);
      console.log(error.response.toString());
      console.log(error.toString());
      throw error;
    });
  });

  require('./profile-card-update/index.js')(testUserIdentity);
  require('./profile-manage/index.js')(testUserIdentity);
  require('./profile-card-get/index.js')(testUserIdentity);
  require('./profile-webhook/index.js')(testUserIdentity);
  require('./profile-buy-points/index.js')(testUserIdentity);
});
