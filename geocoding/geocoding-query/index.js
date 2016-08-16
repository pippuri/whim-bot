'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const ajvFactory = require('ajv');

// Input schema
const schema = require('./schema.json');
const lambda = new AWS.Lambda({ region: process.env.AWS_REGION });
let validate;
Promise.promisifyAll(lambda, { suffix: 'Promise' });

// Initialization work
(function init() {

  // Initialise AJV with the option to use defaults supplied in the schema
  // Note: Types must be coerced as current API Gateway request templates pass them
  // as strings
  const ajv = ajvFactory({ verbose: true, inject: true, coerceTypes: true });

  // Add a new handler
  ajv.addKeyword('inject', {
    compile: function (schema) {
      if (!this._opts.inject) return function () { return true; };

      return function (data, dataPath, parentData, parentDataProperty) {
        for (let key in schema) { // eslint-disable-line prefer-const
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

}());

function delegate(event) {
  const provider = 'MaaS-provider-here-geocoding';

  // Replace local stage name with dev (no 'local' in AWS side);
  const stage = process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev');

  //console.info('Invoking provider', provider, "with input",
  //  JSON.stringify(event, null, 2));

  return lambda.invokePromise({
    FunctionName: provider,
    Qualifier: stage,
    Payload: JSON.stringify(event),
  })
  .then(response => {
    const payload = JSON.parse(response.Payload);

    if (payload.error) {
      return Promise.reject(new Error(payload.error));
    }

    if (payload.errorMessage) {
      return Promise.reject(new Error(payload.errorMessage));
    }

    // Add some debug info to response
    payload.provider = provider;
    return payload;
  });
}

module.exports.respond = function (event, callback) {

  // Validate & set defaults
  new Promise((resolve, reject) => {
    const valid = validate(event.query);

    if (!valid) {
      console.info('errors', event.query, validate.errors);
      return reject(new Error(JSON.stringify(validate.errors)));
    }

    return resolve(valid);
  })
  .then(() => {
    return delegate(event.query);
  })
  .then(results => {

    // Replace the delegate query info with our own query
    results.query = event.query;
    callback(null, results);
  })
  .catch(err => {
    console.info('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn('Error:', err.errors);

    // TODO Process the error
    callback(err);
  });
};
