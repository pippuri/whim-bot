'use strict';

const testQuery = require('./feature-query');

describe('Reverse geocoding provider', function () {
  describe('GOOGLE', function () {
    const lambda = require('../../provider-google/provider-google-reverse-geocoding/handler.js');
    const schema = require('../../geocoding/geocoding-query/response-schema.json');
    const fixture = require('./fixture.json');

    this.timeout(20000);
    testQuery(lambda, schema, fixture);
  });
});
