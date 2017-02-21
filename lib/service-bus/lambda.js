'use strict';

const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({ region: process.env.AWS_REGION });

function invokePromise(functionName, event) {
  const envelope = {
    FunctionName: functionName,
    Qualifier: process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev'),
    ClientContext: new Buffer(JSON.stringify({})).toString('base64'),
    Payload: JSON.stringify(event),
  };

  return lambda.invoke(envelope).promise()
    .then(response => {
      const payload = JSON.parse(response.Payload);

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
