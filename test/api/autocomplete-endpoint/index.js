'use strict';

const testQuery = require('./feature-query.js');

describe('autocomplete endpoint', () => {
  const lambda = require('../../../autocomplete/autocomplete-query/handler.js');
  testQuery(lambda);
});
