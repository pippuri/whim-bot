const testQuery = require('./feature-query.js');

describe('autocomplete endpoint', function () {
  this.timeout(20000);

  const lambda = require('../../../autocomplete/autocomplete-query/handler.js');
  testQuery(lambda);
});
