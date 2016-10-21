'use strict';

const testQuery = require('./feature-query');
const fixture = require('./fixture.json');

describe('Reverse geocoding provider', () => {
  describe('GOOGLE', () => {
    const lambda = require('../../../provider-google/provider-google-reverse-geocoding/handler.js');

    testQuery(lambda, fixture);
  });

  describe('HERE', () => {
    const lambda = require('../../../provider-google/provider-google-reverse-geocoding/handler.js');

    testQuery(lambda, fixture);
  });
});
