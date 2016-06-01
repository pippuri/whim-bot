
const testUnknownTransformation = require('./error-unknown-transformation.js');
const testGetRoutes = require('./feature-get-routes.js');

describe('business rule engine', function () {

  const engine = require('../../../lib/business-rule-engine/index.js');
  testUnknownTransformation(engine);
  testGetRoutes(engine);

});
