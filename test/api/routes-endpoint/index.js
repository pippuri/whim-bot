'use strict';

const testMissingidentityId = require('./error-missing-principal-id.js');
const testLeaveAndArrive = require('./error-leave-and-arrive.js');
const testMissingFrom = require('./error-missing-from.js');
const testMissingTo = require('./error-missing-to.js');
const testLeaveAt = require('./feature-leave-at.js');

describe('routes endpoint', function () {
  this.timeout(20000);

  const lambda = require('../../../routes/routes-query/handler.js');
  testMissingidentityId(lambda);
  testMissingFrom(lambda);
  testMissingTo(lambda);
  testLeaveAndArrive(lambda);
  testLeaveAt(lambda);

});
