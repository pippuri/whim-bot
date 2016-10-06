'use strict';

const jwt = require('jsonwebtoken');
const Templates = (new (require('serverless'))()).classes.Templates;

function usage() {
  console.log('Usage: node generate-jwt-token.js <stage> <identityId>');
}

/**
 * Loads the environment with a given stage
 * @param {string} stage the stage to use when loading env, defaults to 'dev'
 */
function fetchSecret(stage) {
  // Default to dev
  stage = stage || 'dev';

  const values = require(`../_meta/variables/s-variables-${stage}.json`);
  const variables = (new Templates(values, '../s-templates.json')).toObject();
  return variables.JWT_SECRET;
}

// Read args for parameters
const stage = process.argv[2];
const identityId = process.argv[3];

if (typeof stage !== 'string') {
  console.error('Missing argument <stage>');
  usage();
  process.exit(1);
}

if (typeof identityId !== 'string') {
  console.error('Missing argument <identityId>');
  usage();
  process.exit(1);
}

const secret = fetchSecret(stage);
const token = jwt.sign({ id: identityId }, secret);

console.log(`Generated Bearer token: 'Bearer ${token}'`);
