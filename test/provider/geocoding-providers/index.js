'use strict';

const testQuery = require('./feature-query');

describe('geocoding provider', () => {
  describe('HERE', function () {
    const lambda = require('../../../provider-here/provider-here-geocoding/handler.js');
    const schema = require('../../../geocoding/geocoding-query/response-schema.json');
    const fixture = require('./fixture.json');

    this.timeout(20000);
    testQuery(lambda, schema, fixture);
  });

  describe('Google', function () {
    const lambda = require('../../../provider-google/provider-google-geocoding/handler.js');
    const schema = require('../../../geocoding/geocoding-query/response-schema.json');
    const fixture = require('./fixture.json');

    this.timeout(20000);
    testQuery(lambda, schema, fixture);
  });
});
