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
        process.env.SERVERLESS_STAGE = stage;
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
