'use strict';

const Templates = (new (require('serverless'))()).classes.Templates;

function loadEnvironment() {

  let values;
  let loading = true;
  const stages = ['dev', 'test', 'alpha'];

  stages.forEach(stage => {
    if (loading) {
      try {
        loading = false;
        values = require(`../_meta/variables/s-variables-${stage}.json`);
        console.log(`Using ${stage} variables`);
      } catch (e) {
        console.log(`Failed to read _meta/variables/s-variables-${stage}.json`);
        loading = true;
      }
    }
  });

  // After trying to load files with all stages, throw Error
  if (loading) {
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
