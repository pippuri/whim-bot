'use strict';

const testGeocoding = require('./feature-geocoding.js');
const testReverseGeocoding = require('./feature-reverse-geocoding.js');

describe('geocoding', function () {
  this.timeout(20000);

  describe('geocoding endpoint', () => {
    const lambda = require('../../../geocoding/geocoding-query/handler.js');
    testGeocoding(lambda);
  });

  describe('reverse geocoding endpoint', () => {
    const lambda = require('../../../geocoding/reverse-geocoding-query/handler.js');
    testReverseGeocoding(lambda);
  });
});
