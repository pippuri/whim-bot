'use strict';

const testQuery = require('./feature-query');
const fixture = require('./fixture.json');

describe('Reverse geocoding provider', () => {
  describe('GOOGLE', function () {
    const lambda = require('../../../provider-google/provider-google-reverse-geocoding/handler.js');

    this.timeout(20000);
    testQuery(lambda, fixture);
  });

  describe('HERE', function () {
    const lambda = require('../../../provider-google/provider-google-reverse-geocoding/handler.js');

    this.timeout(20000);
    testQuery(lambda, fixture);
  });
});
