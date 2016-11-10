'use strict';

const testQuery = require('./feature-query');
const fixture = require('./fixture.json');

describe('geocoding provider', () => {
  describe('HERE', () => {
    const lambda = require('../../../geocoding/providers/provider-here-geocoding/handler.js');

    testQuery(lambda, fixture);
  });

  describe('Google', () => {
    const lambda = require('../../../geocoding/providers/provider-google-geocoding/handler.js');

    testQuery(lambda, fixture);
  });
});
