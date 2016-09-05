'use strict';

const testFeature = require('./feature-test');
const testError = require('./error-test');


describe('routes endpoint', function () {
  this.timeout(20000);

  describe('features tests', () => {
    testFeature();
  });

  describe('errors tests', () => {
    testError();
  });

});
