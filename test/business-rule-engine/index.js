'use strict';

// Unknown rule
const testUnknownRequest = require('./error-unknown-request');

// get-point-pricing
// get-point-pricing-batch
const testGetPointPricing = require('./get-points/feature-get-point-pricing');
const testGetPointPricingBatch = require('./get-points/feature-get-point-pricing-batch');

// get-booking-provider-mode-location
// get-booking-provider-agencyid-location
const testGetBookingProviders = require('./get-provider/feature-get-booking-providers.js');

// get-point-pricing
// get-point-pricing-batch
const testGetTspPricing = require('./get-tsp-pricing/feature-get-tsp-pricing');

describe('Business rule engine', function () {
  this.timeout(20000);

  describe('Unknown request', () => {
    testUnknownRequest();
  });

  describe('Rule: get-booking-providers', () => {
    testGetBookingProviders();
  });

  describe('Rule: get-point-pricing', () => {
    testGetPointPricing();
  });

  describe('Rule: get-point-pricing-batch', () => {
    testGetPointPricingBatch();
  });

  describe('Rule: get-tsp-pricing', () => {
    testGetTspPricing();
  });
});
