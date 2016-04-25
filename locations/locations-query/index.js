var BBPromise = require('bluebird');
var AWS = require('aws-sdk');
var ajvFactory = require('ajv');

// Input schema
var schema = require('./schema.json');
var lambda = new AWS.Lambda({ region:process.env.AWS_REGION });
var validate;
BBPromise.promisifyAll(lambda, { suffix: 'BBPromise' });

// Initialization work
(function init() {
  // Initialise AJV with the option to use defaults supplied in the schema
  // Note: Types must be coerced as current API Gateway request templates pass them
  // as strings
  var ajv = ajvFactory({ inject: true, coerceTypes: true });

  // Add a new handler
  ajv.addKeyword('inject', {
    compile: function (schema) {
      if (!this._opts.inject) return function () { return true; };

      return function (data, dataPath, parentData, parentDataProperty) {
        for (var key in schema) {
          if (typeof data[key] === 'undefined') {
            data[key] = schema[key];
          }
        }

        return true;
      };
    },
  });

  // Compile schema
  validate = ajv.compile(schema);

  // Promisify Lambda helpers
  var lambda = new AWS.Lambda({ region: process.env.AWS_REGION });
  BBPromise.promisifyAll(lambda, { suffix: 'BBPromise' });
})();

function delegate(event) {
  var provider = 'MaaS-provider-nominatim-locations';

  // Replace local stage name with dev (no 'local' in AWS side);
  var stage = process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev');

  //console.log('Invoking provider', provider, "with input",
  //  JSON.stringify(event, null, 2));

  return lambda.invokeBBPromise({
    FunctionName: provider,
    Qualifier: stage,
    Payload: JSON.stringify(event),
  })
  .then(function (response) {
    var payload = JSON.parse(response.Payload);

    if (payload.error) {
      return BBPromise.reject(new Error(payload.error));
    }

    if (payload.errorMessage) {
      return BBPromise.reject(new Error(payload.errorMessage));
    }

    // Add some debug info to response
    payload.provider = provider;
    return payload;
  });
}

module.exports.respond = function (event, callback) {

  // Validate & set defaults
  new BBPromise(function (resolve, reject) {
      var valid = validate(event.query);

      if (!valid) {
        return reject(new Error(JSON.stringify(validate.errors)));
      }

      return resolve(valid);
    })
    .then(function valid() {
      return delegate(event.query);
    })
    .then(function (results) {
      callback(null, results);
    })
    .catch(function (err) {
      console.warn('Error:', err.errors);

      // TODO Process the error
      callback(err);
    });
};
