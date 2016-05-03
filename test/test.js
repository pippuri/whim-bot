try {
  var variables = require('../_meta/variables/s-variables-dev.json');
  for (var key in variables) {
    if (variables.hasOwnProperty(key)) {
      var value = variables[key];
      process.env[key] = value;
    }

  }

} catch (e) {
  // the json file probably does not exist
}

describe('MaaS.fi backend', function () {
  require('./api/test.js');
  require('./routes-providers/test.js');
  require('./geocoding-providers/test.js');
  require('./autocomplete-providers/test.js');
  require('./lib/test.js');
});

