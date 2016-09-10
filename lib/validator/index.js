'use strict';

/**
 * A simple Promisified schema validator that can resolve nested
 * refs with absolute path based on a root URL (here project root)
 *
 * E.g.
 * validator.validate(object, schema)
 *  .catch(error => // Error)
 *  .then(result => // OK)
 */
const Promise = require('bluebird');
const ajvFactory = require('ajv');
const ValidationError = require('./ValidationError');

/**
 * Validate an object using schema retrieved from schemaId. This validator does
 * not resolve schema references, e.g. give it a fully dereferenced input.
 *
 * @param {object} schema the schema object
 * @param {object} object the object to validate
 * @param {object} options optional validation options (see ajv documentation)
 * @return {Promise -> Object} resolve w/validated object or reject w/error if invalid
 */
function validate(schema, object, options) {
  const opts = Object.assign({ verbose: true, allErrors: true }, options);
  const ajv = ajvFactory(opts);
  const ajvValidate = ajv.compile(schema);
  const valid = ajvValidate(object);

  if (valid) {
    return Promise.resolve(object);
  }

  console.log(ajvValidate.errors);

  return Promise.reject(ValidationError.fromValidatorErrors(ajvValidate.errors));
}

module.exports = {
  validate,
};
