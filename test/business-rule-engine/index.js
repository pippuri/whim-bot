'use strict';

// Unknown rule
const testUnknownRequest = require('./error-unknown-request');

// get-point-pricing
// get-point-pricing-batch
const testGetPointPricing = require('./get-points/feature-get-point-pricing');
const testGetPointPricingBatch = require('./get-points/feature-get-point-pricing-batch');

// get-routes
const testGetRoutes = require('./get-routes/feature-get-routes');
const testPlanLevel = require('./get-routes/feature-different-planlevel.js');

// get-booking-provider
// get-booking-provider-batch
// get-routes-providers-batch
// NOTE get-booking-provider basically gets batch with 1 request, no test needed
const testGetBookingProviderBatch = require('./get-provider/feature-get-booking-provider-batch.js');
const testGetRoutesProvidersBatch = require('./get-provider/feature-get-routes-providers-batch.js');

// get-point-pricing
// get-point-pricing-batch
const testGetTspPricing = require('./get-tsp-pricing/feature-get-tsp-pricing');

describe('Business rule engine', function () {
  this.timeout(20000);

  describe('Unknown request', () => {
    testUnknownRequest();
  });

  describe('Rule: get-routes', () => {
    testGetRoutes();

    describe('Rule: engine rules with different planLevel users', () => {
      testPlanLevel();
    });
  });

  describe('Rule: get-routes-providers-batch', () => {
    testGetRoutesProvidersBatch();
  });

  describe('Rule: get-booking-provider-batch', () => {
    testGetBookingProviderBatch();
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
