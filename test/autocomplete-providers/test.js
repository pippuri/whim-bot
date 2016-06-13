'use strict';

const testAutocomplete = require('./feature-query.js');

describe('autocomplete provider', function () {

  describe('Google Places', function () {
    this.timeout(20000);
    const lambda = require('../../provider-google/provider-google-autocomplete/handler.js');
    testAutocomplete(lambda);
  });

  describe('HERE', function () {
    this.timeout(20000);
    const lambda = require('../../provider-here/provider-here-autocomplete/handler.js');
    testAutocomplete(lambda);
  });

});
