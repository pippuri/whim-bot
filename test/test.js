'use strict';

const Templates = (new (require('serverless'))()).classes.Templates;

function loadEnvironment() {

  let values;
  let loadingError;

  try {
    loadingError = false;
    values = require('../_meta/variables/s-variables-dev.json');
  } catch (e) {
    console.log('Failed to read _meta/variables/s-variables-dev.json');
    loadingError = true;
  }

  if (loadingError) {
    try {
      loadingError = false;
      values = require('../_meta/variables/s-variables-test.json');
    } catch (e) {
      console.log('Failed to read _meta/variables/s-variables-test.json');
      loadingError = true;
    }
  }

  if (loadingError) {
    try {
      loadingError = false;
      values = require('../_meta/variables/s-variables-alpha.json');
    } catch (e) {
      console.log('Failed to read _meta/variables/s-variables-alpha.json');
      loadingError = true;
    }
  }

  if (loadingError) {
    throw Error('Unable to read any s-variables json file');
  }

  const variables = (new Templates(values, '../s-templates.json')).toObject();
  for (let key of Object.keys(variables)) { // eslint-disable-line prefer-const
    process.env[key] = variables[key];
  }

}

loadEnvironment();

// Handle AWS Lambda calls locally
process.env.maas_test_run = true;

describe('MaaS.fi backend', () => {
  require('./api/index.js');
  require('./profile/index.js');
  require('./provider/index.js');
  require('./lib/index.js');
});
