'use strict';

const testQuery = require('./feature-query');
const fixture = require('./fixture.json');

describe('geocoding provider', () => {
  describe('HERE', function () {
    const lambda = require('../../../provider-here/provider-here-geocoding/handler.js');

    this.timeout(20000);
    testQuery(lambda, fixture);
  });

  describe('Google', function () {
    const lambda = require('../../../provider-google/provider-google-geocoding/handler.js');

    this.timeout(20000);
    testQuery(lambda, fixture);
  });
});
