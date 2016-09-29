'use strict';

const Templates = (new (require('serverless'))()).classes.Templates;

function loadEnvironment() {
  // The stages we can run tests against in priority order - always fallback to dev
  const stages = ['test', 'dev'];

  // Check the stage from the existence of meta sync file
  const stage = stages.find(stage => {
    try {
      const path = `_meta/variables/s-variables-${stage}.json`;
      console.info(`Trying to load variables from '${path}'.`);
      require(`../${path}`);
      return true;
    } catch (error) {
      console.info(`Failed: ${error.message}`);
      return false;
    }
  });

  if (!stage) {
    console.error('Failed to find stage environment variables. Exiting.');
    process.exit(2);
  }

  // Read the variables from the given path
  console.info(`Using stage '${stage}' variables for running the tests.`);
  const values = require(`../_meta/variables/s-variables-${stage}.json`);
  const variables = (new Templates(values, '../s-templates.json')).toObject();
  for (let key of Object.keys(variables)) { // eslint-disable-line prefer-const
    process.env[key] = variables[key];
  }
}

loadEnvironment();
console.info = () => {};
//console.warn = () => {};

// Force local lambda & dynamo usage
process.env.USE_MOCK_LAMBDA = 'TRUE';
process.env.USE_MOCK_DYNAMO = 'TRUE';

describe('MaaS.fi backend', () => {
  require('./api/index.js');
  require('./profile/index.js');
  require('./provider/index.js');
  require('./lib/index.js');
});
