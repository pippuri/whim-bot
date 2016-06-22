'use strict';

/**
 * A simple Promisified schema validator that can resolve nested
 * refs with absolute path based on a root URL (here project root)
 *
 * E.g.
 * - create refs to schemas as $ref: '/schemas/foo.json'
 * - call validator
 * validator.validate(object, schema)
 *  .then(result => {
 *    if (result) {
 *      // We got an error
 *    }
 *    else {
 *      // Result ok, we got null
 *    }
 *  }
 */
const path = require('path');
const ajvFactory = require('ajv');
const deref = require('json-schema-deref');
const Promise = require('bluebird');

const ajv = ajvFactory({ verbose: true });

function dereference(schema) {
  return new Promise((resolve, reject) => {
    const options = {
      failOnMissing: true,
      baseFolder: path.resolve(__dirname, '../../schemas'),
    };

    deref(schema, options, (err, dereferenced) => {
      if (err) {
        return reject(err);
      }

      return resolve(dereferenced);
    });
  });
}

/**
 * Makes the AJV returned errors a bit more readable
 */
function parseErrors(errors) {
  return errors;
}

// Promisify fs
function validate(object, schema) {
  return dereference(schema)
    .catch(error => {
      console.log(error);
      throw new Error('Runtime error: Invalid JSON schema.');
    })
    .then(dereferenced => {
      // Validate it
      const validate = ajv.compile(dereferenced);
      const valid = validate(object);

      if (valid) {
        return Promise.resolve(null);
      }

      const errors = parseErrors(validate.errors);
      console.warn(errors);

      return Promise.resolve(errors);
    });
}

module.exports = {
  validate: validate,
  dereference: dereference,
};
