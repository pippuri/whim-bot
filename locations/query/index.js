var Promise = require('bluebird');
var AWS = require('aws-sdk');
var AJV = require('ajv');

// Input schema
var schema = require('./schema.json');
var lambda = new AWS.Lambda({region:process.env.AWS_REGION});
var validate;
Promise.promisifyAll(lambda, { suffix: 'Promise' });

// Initialization work
(function init() {
  // Initialise AJV with the option to use defaults supplied in the schema
  var ajv = AJV({ inject: true, async: true });

  // Add a new handler
  ajv.addKeyword('inject', { 
    compile: function(schema) {
      if (!this._opts.inject) return function() { return true; }

      return function(data, dataPath, parentData, parentDataProperty) {
        for (key in schema) {
          if (typeof data[key] === 'undefined') {
            data[key] = schema[key];
          }
        }
        return true;
      };
    }
  });

  // Compile schema
  validate = ajv.compile(schema);

  // Promisify Lambda helpers
  var lambda = new AWS.Lambda({ region: process.env.AWS_REGION });
  Promise.promisifyAll(lambda, { suffix: 'Promise' });
})();

function delegate(event) {
  var name = 'MaaS-provider-here-locations';
  // Replace local stage name with dev (no 'local' in AWS side);
  var stage = process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev');
  console.log('Invoking adapter', name);

  return lambda.invokePromise({
    FunctionName: name,
    Qualifier: stage,
    Payload: JSON.stringify(event)
  });
}

module.exports.respond = function (event, callback) {
  // Validate & set defaults
  validate(event)
    .then(function valid() {
      return delegate(event);
    })
    .then(function(results) {
      console.log(results);
      callback(null, results);
    })
    .catch(function (err) {
      console.warn('Error:', err.errors);

      // TODO Process the error
      callback(err);
    });
};
