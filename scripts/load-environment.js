'use strict';

const Templates = (new (require('serverless'))()).classes.Templates;

function loadEnvironment() {
  // The stages we can run tests against in priority order - always fallback to dev
  const stages = ['dev', 'test'];
  const dataCenter = 'euwest1';

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
  console.info(`Running against datacenter '${dataCenter}' setup.`);

  const valuesFile = require(`../_meta/variables/s-variables-${stage}.json`);
  const dataCenterValuesFile = require(`../_meta/variables/s-variables-${stage}-${dataCenter}.json`);
  const template = require('../s-templates.json').environment;

  const values = new Templates(valuesFile);
  values.setParents([new Templates(dataCenterValuesFile)]);
  const allValues = values.toObject();
  for (let key of Object.keys(template)) { // eslint-disable-line prefer-const
    const variableKey = template[key].match(/^\${(.*)}$/);
    template[key] = variableKey ? allValues[variableKey[1]] : undefined;
    // Use the environment if given, fallback to SLS meta
    process.env[key] = process.env[key] ? process.env[key] : template[key];
  }
}

module.exports = {
  loadEnvironment,
};
