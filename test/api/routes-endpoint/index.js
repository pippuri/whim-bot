'use strict';

const testFeature = require('./feature-test');
const testError = require('./error-test');


describe('routes endpoint', () => {
  describe('features tests', () => {
    testFeature();
  });

  describe('errors tests', () => {
    testError();
  });

});
