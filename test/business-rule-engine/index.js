'use strict';

const testUnknownRequest = require('./error-unknown-request');

const testGetPointPricing = require('./feature-get-point-pricing');
const testGetPointPricingBatch = require('./feature-get-point-pricing-batch');

const testGetProvider = require('./feature-get-provider');
const testGetProviderBatch = require('./feature-get-provider-batch');

const testGetRoutes = require('./feature-get-routes');

const testGetTspPricing = require('./feature-get-tsp-pricing');

const testPlanLevel = require('./feature-different-planlevel.js');

describe('business rule engine', function () {
  this.timeout(20000);
  testGetProvider();
  testGetProviderBatch();
  testUnknownRequest();
  testGetRoutes();
  testGetPointPricing();
  testGetPointPricingBatch();
  testGetTspPricing();
  testPlanLevel();
});
