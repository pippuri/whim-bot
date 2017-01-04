'use strict';

describe('business-objects', () => {
  describe('Profile', () => {
    require('./Profile.js');
  });

  describe('Transaction', () => {
    require('./Transaction.js');
  });

  require('./SubscriptionManager');
});
