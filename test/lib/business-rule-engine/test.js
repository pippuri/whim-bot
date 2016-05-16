
var testUnknownTransformation = require('./error-unknown-transformation.js');
var testGetRoutes = require('./feature-get-routes.js');

describe('business rule engine', function () {

  var engine = require('../../../lib/business-rule-engine/index.js');
  testUnknownTransformation(engine);
  testGetRoutes(engine);

});
