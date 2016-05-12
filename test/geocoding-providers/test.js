var testQuery = require('./feature-query');

describe('geocoding provider', function () {
  describe('HERE', function () {
    var lambda = require('../../provider-here/provider-here-geocoding/handler.js');
    var schema = require('../../geocoding/geocoding-query/response-schema.json');
    var fixture = require('./fixture.json');

    this.timeout(20000);
    testQuery(lambda, schema, fixture);
  });

  describe('Google', function () {
    var lambda = require('../../provider-google/provider-google-geocoding/handler.js');
    var schema = require('../../geocoding/geocoding-query/response-schema.json');
    var fixture = require('./fixture.json');

    this.timeout(20000);
    testQuery(lambda, schema, fixture);
  });
});
