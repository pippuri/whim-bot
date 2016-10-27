'use strict';

const lambda = require('./lambda.js');
const mockLambda = (process.env.USE_MOCK_LAMBDA) ? require('./mockLambda.js') : null;

function call(serviceName, event) {
  if (mockLambda && mockLambda.canCall(serviceName) ) {
    return mockLambda.invokePromise(serviceName, event);
  }

  return lambda.invokePromise(serviceName, event)
    .catch(_error => {
      console.warn(`[ServiceBus] Caught an error calling '${serviceName
      }': ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      return Promise.reject(_error);
    });
}

module.exports = {
  call: call,
};
