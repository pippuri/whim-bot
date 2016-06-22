'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({ region: process.env.AWS_REGION });

Promise.promisifyAll(lambda, { suffix: 'Promise' });

function invokePromise(functionName, event) {
  const envelope = {
    FunctionName: functionName,
    Qualifier: process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev'),
    ClientContext: new Buffer(JSON.stringify({})).toString('base64'),
    Payload: JSON.stringify(event),
  };

  return lambda.invokePromise(envelope)
    .then(response => {
      const payload = JSON.parse(response.Payload);

      return payload;
    })
    .then(payload => {
      if (payload.error) {
        return Promise.reject(new Error(payload.error));
      }

      if (payload.errorMessage) {
        return Promise.reject(new Error(payload.errorMessage));
      }

      return payload;
    });
}

exports = module.exports = {
  invokePromise: invokePromise,
};
