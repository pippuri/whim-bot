/**
 * A simple Promisified schema validator that can resolve nested
 * refs with absolute path based on a root URL (here project root)
 *
 * E.g.
 * - create refs to schemas as $ref: '/schemas/foo.json'
 * - call validator
 * validator.validate(object, schema)
 *  .then((result) => {
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

function dereferenceSchema(schema) {
  return new Promise((resolve, reject) => {
    var options = {
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
  return dereferenceSchema(schema)
    .catch((error) => {
      console.log(error);
      throw new Error('Runtime error: Invalid JSON schema.');
    })
    .then((dereferenced) => {
      // Validate it
      var validate = ajv.compile(dereferenced);
      var valid = validate(object);
      var errors;

      if (valid) {
        return Promise.resolve(null);
      }

      errors = parseErrors(validate.errors);

      return Promise.resolve(errors);
    });
}

module.exports = {
  validate: validate,
};