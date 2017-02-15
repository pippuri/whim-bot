'use strict';

describe('business-objects', () => {
  describe('Profile', () => {
    require('./Profile.js');
  });

  describe('Transaction', () => {
    require('./Transaction.js');
  });


  describe('Pricing', () => {
    require('./Pricing.js');
  });

  require('./SubscriptionManager');
  require('./Booking');
});
