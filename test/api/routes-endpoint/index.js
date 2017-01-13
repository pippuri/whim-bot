'use strict';

const testGetRoutes = require('./feature-get-routes.js');
const testPlanLevel = require('./feature-different-planlevel.js');
const testGetRoutesProviders = require('./routes-providers-test.js');
const testFeature = require('./feature-test');
const testError = require('./error-test');


describe('routes endpoint', () => {
  describe('routes providers tests', () => {
    testGetRoutesProviders();
  });

  describe('routes tests', () => {
    testGetRoutes();
  });

  describe('routes plan level tests', () => {
    testPlanLevel();
  });

  describe('features tests', () => {
    testFeature();
  });

  describe('errors tests', () => {
    testError();
  });

});
