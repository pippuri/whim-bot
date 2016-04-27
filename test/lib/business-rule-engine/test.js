
var testUnknownPlan = require('./error-unknown-plan.js');
var testGetPolicy = require('./feature-get-policy.js');

describe('business rule engine', function () {

  var store = require('../../../lib/business-rule-engine/index.js');
  testUnknownPlan(store);
  testGetPolicy(store);

});
