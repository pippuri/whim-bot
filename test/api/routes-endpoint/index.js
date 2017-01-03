'use strict';

const testFeature = require('./feature-test');
const testError = require('./error-test');
const testGetRoutesProviders = require('./routes-providers-test.js');


describe('routes endpoint', () => {
  describe('routes providers tests', () => {
    testFeature();
  });

  describe('features tests', () => {
    testFeature();
  });


  describe('errors tests', () => {
    testError();
  });

});
