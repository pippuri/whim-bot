
var Templates = (new (require('serverless'))()).classes.Templates;

function loadEnvironment() {

  var values;
  try {
    values = require('../_meta/variables/s-variables-dev.json');
  } catch (e) {
    console.log('Failed to read _meta/variables/s-variables-dev.json');
  }

  var variables = (new Templates(values, '../s-templates.json')).toObject();
  for (var key of Object.keys(variables)) {
    process.env[key] = variables[key];
  }

}

loadEnvironment();

// Handle AWS Lambda calls locally
process.env.maas_test_run = true;

describe('MaaS.fi backend', function () {
  require('./api/test.js');
  require('./routes-providers/test.js');
  require('./geocoding-providers/test.js');
  require('./reverse-geocoding-providers/test.js');
  require('./autocomplete-providers/test.js');
  require('./taxi-providers/test.js');
  require('./lib/test.js');
});

