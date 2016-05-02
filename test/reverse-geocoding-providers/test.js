var testQuery = require('./feature-query');

describe('Reverse geocoding provider', function () {
  describe('GOOGLE', function () {
    var lambda = require('../../provider-google/provider-google-reverse-geocoding/handler.js');
    var schema = require('../../geocoding/geocoding-query/response-schema.json');
    var fixture = require('./fixture.json');

    this.timeout(20000);
    testQuery(lambda, schema, fixture);
  });
});
