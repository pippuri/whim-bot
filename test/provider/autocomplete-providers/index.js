'use strict';

const testAutocomplete = require('./feature-query.js');

describe('autocomplete provider', () => {

  describe('Google Places', () => {
    const lambda = require('../../../autocomplete/providers/provider-google-autocomplete/handler.js');
    testAutocomplete(lambda);
  });

  describe('HERE', () => {
    const lambda = require('../../../autocomplete/providers/provider-here-autocomplete/handler.js');
    testAutocomplete(lambda);
  });
});
