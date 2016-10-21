'use strict';

const testQuery = require('./feature-query');
const fixture = require('./fixture.json');

describe('geocoding provider', () => {
  describe('HERE', () => {
    const lambda = require('../../../provider-here/provider-here-geocoding/handler.js');

    testQuery(lambda, fixture);
  });

  describe('Google', () => {
    const lambda = require('../../../provider-google/provider-google-geocoding/handler.js');

    testQuery(lambda, fixture);
  });
});
