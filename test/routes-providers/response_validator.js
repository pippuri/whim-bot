var ajvFactory = require('ajv');

var schema = require('./response_schema.json');

module.exports = function (response) {
  var ajv = ajvFactory();
  var validate = ajv.compile(schema);
  var valid = validate(response);
  var validationError = valid ? null : JSON.stringify(validate.errors);
  return validationError;
};
