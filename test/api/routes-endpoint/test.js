
var testMissingPrincipalId = require('./error-missing-principal-id.js');
var testLeaveAndArrive = require('./error-leave-and-arrive.js');
var testMissingFrom = require('./error-missing-from.js');
var testMissingTo = require('./error-missing-to.js');

describe('routes endpoint', function () {

  var lambda = require('../../../routes/routes-query/handler.js');
  testMissingPrincipalId(lambda);
  testMissingFrom(lambda);
  testMissingTo(lambda);
  testLeaveAndArrive(lambda);

});
