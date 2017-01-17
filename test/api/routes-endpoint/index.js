'use strict';

const testPlanLevel = require('./feature-different-planlevel.js');
const testGetRoutesProviders = require('./routes-providers-test.js');
const testFeature = require('./feature-test');
const fixtureTests = require('./fixture-tests');
const testError = require('./error-test');


describe('routes endpoint', () => {
  describe('routes providers tests', () => {
    testGetRoutesProviders();
  });

  describe('routes plan level tests', () => {
    testPlanLevel();
  });

  describe('features tests', () => {
    testFeature();
  });

  describe('fixture tests', () => {
    fixtureTests();
  });

  describe('errors tests', () => {
    testError();
  });

});
