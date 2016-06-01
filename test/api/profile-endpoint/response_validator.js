const ajvFactory = require('ajv');

const schema = require('./response_schema.json');

module.exports = function (response) {
  const ajv = ajvFactory();
  const validate = ajv.compile(schema);
  const valid = validate(response);
  const validationError = valid ? null : JSON.stringify(validate.errors);
  return validationError;
};
