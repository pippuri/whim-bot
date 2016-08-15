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

const schemas = require('../../maas-schemas');
const validate = schemas.validate;
const derefSchema = schemas.derefSchema;
const resolveSchemaFromPath = schemas.resolveSchemaFromPath;

module.exports = {
  validate: validate,
  dereference: derefSchema,
  resolveSchemaFromPath: resolveSchemaFromPath,
};
