'use strict';

const jwt = require('jsonwebtoken');
const Templates = (new (require('serverless'))()).classes.Templates;

function usage() {
  console.log('Usage: node decode-jwt-token.js <stage> <token>');
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
const token = process.argv[3];

if (typeof stage !== 'string') {
  console.error('Missing argument <stage>');
  usage();
  process.exit(1);
}

if (typeof token !== 'string') {
  console.error('Missing argument <token>');
  usage();
  process.exit(1);
}

const secret = fetchSecret(stage);
try {
  const decoded = jwt.verify(token, secret);
  console.log(`Decoded token: ${JSON.stringify(decoded)}'`);
} catch (error) {
  console.error('Caught an error', error.toString());
  console.error('Token:', token);
}
