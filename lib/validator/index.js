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
const ajvFactory = require('ajv');
const ValidationError = require('./ValidationError');
const _sanitize = require('../../lib/utils/index').sanitize;

/**
 * Transforms the given values in input object with a given replacement.
 * Returns the other values as-is. Note that the values are compared with
 * equality match, e.g. it will only work for simple values (not objects).
 *
 * @param {object} input the object
 * @param {any} original the original values to track
 * @param {any} replacement the value to replace the value with
 * @return {object} a copy of the object, with the given values transformed
 */
function transform(input, original, replacement) {

  // Return the simple value (non-object); Arrays are considered simple values,
  // even if their typeof returns object; note that nulls are objects; we
  // accept root-level nulls, but disallow them inside objects.
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  // Handle a complex case (Object)
  const output = {};
  Object.keys(input).forEach(key => {
    const value = input[key];

    if (value === original) {
      output[key] = replacement;
      return;
    }

    output[key] = transform(value, original, replacement);
  });

  return output;
}

/**
 * Synchronously validate an object using schema retrieved from schemaId.
 * This validator does not resolve schema references, e.g. give it a fully
 * dereferenced input.
 *
 * @param {object} schema the schema object
 * @param {object} object the object to validate
 * @param {object} options optional validation options (see ajv documentation)
 * @return {object} validated and coerced object if everything goes alright
 * @throws {ValidationError} in case of invalid object
 * @throws {TypeError} in case of invalid schema
 */
function validateSync(schema, object, options) {
  const opts = Object.assign({ verbose: true, allErrors: true,
    validateSchema: false, addUsedSchema: false, meta: false, inlineRefs: false,
    sourceCode: false, errorDataPath: 'property', multipleOfPrecision: 6 },
    options);

  // Always re-create AJV, because options may have changed
  const ajv = ajvFactory(opts);

  // Handle the transformation of the given values (mainly for API gateway)
  if (typeof opts.transform === 'object') {
    const trans = opts.transform;
    if (!trans.hasOwnProperty('from')) {
      throw new TypeError('Invalid transform options: \'from\' not given.');
    }

    if (!trans.hasOwnProperty('to')) {
      throw new TypeError('Invalid transform options: \'to\' not given.');
    }

    object = transform(object, trans.from, trans.to);
  }

  if (opts.sanitize === true) {
    object = _sanitize(object);
  }

  const ajvValidate = ajv.compile(schema);
  const valid = ajvValidate(object);

  if (!valid) {
    throw ValidationError.fromValidatorErrors(ajvValidate.errors, object);
  }

  return object;
}

/**
 * Validate an object using schema retrieved from schemaId. This validator does
 * not resolve schema references, e.g. give it a fully dereferenced input.
 *
 * This method calls validateSync() internally.
 *
 * @param {object} schema the schema object
 * @param {object} object the object to validate
 * @param {object} options optional validation options (see ajv documentation)
 * @return {Promise -> Object} resolve w/validated object or reject w/error if invalid
 * @see validateSync()
 */
function validate(schema, object, options) {
  try {
    return Promise.resolve(validateSync(schema, object, options));
  } catch (error) {
    return Promise.reject(error);
  }
}

module.exports = {
  validate,
  validateSync,
};
