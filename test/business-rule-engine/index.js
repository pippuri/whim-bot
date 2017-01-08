'use strict';

// Unknown rule
const testUnknownRequest = require('./error-unknown-request');
const testGetBookingProviders = require('./get-provider/feature-get-booking-providers.js');
const testGetTspPricing = require('./get-tsp-pricing/feature-get-tsp-pricing');

describe('Business rule engine', function () {
  this.timeout(20000);

  describe('Unknown request', () => {
    testUnknownRequest();
  });

  describe('Rule: get-booking-providers', () => {
    testGetBookingProviders();
  });

  describe('Rule: get-tsp-pricing', () => {
    testGetTspPricing();
  });
});
