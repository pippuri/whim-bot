'use strict';

const testAutocomplete = require('./feature-query.js');

describe('autocomplete provider', () => {

  describe('Google Places', () => {
    const lambda = require('../../../provider-google/provider-google-autocomplete/handler.js');
    testAutocomplete(lambda);
  });

  describe('HERE', () => {
    const lambda = require('../../../provider-here/provider-here-autocomplete/handler.js');
    testAutocomplete(lambda);
  });
});
