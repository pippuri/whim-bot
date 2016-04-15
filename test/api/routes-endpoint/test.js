
var testLeaveAndArrive = require('./error-leave-and-arrive.js');
var testMissingFrom = require('./error-missing-from.js');
var testMissingTo = require('./error-missing-to.js');

describe('routes endpoint', function () {

  var lambda = require('../../../routes/routes-query/handler.js');
  testMissingFrom(lambda);
  testMissingTo(lambda);
  testLeaveAndArrive(lambda);

});
