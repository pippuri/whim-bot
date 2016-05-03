var testAutocomplete = require('./feature-query.js');

describe('autocomplete provider', function () {

  describe('Google Places', function () {
    this.timeout(20000);
    var lambda = require('../../provider-google/provider-google-autocomplete/handler.js');
    testAutocomplete(lambda);
  });

  describe('HERE', function () {
    this.timeout(20000);
    var lambda = require('../../provider-here/provider-here-autocomplete/handler.js');
    testAutocomplete(lambda);
  });

});
