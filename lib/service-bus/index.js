'use strict';

const _case = require('case-expression');
const _default = () => true;

const lambda = require('./lambda.js');
const mockLambda = (process.env.USE_MOCK_LAMBDA) ? require('./mockLambda.js') : null;
// const mockProfiles = require('./mockProfiles.json');

function call(serviceName, event) {

  return _case(serviceName, [

    _default, () => {
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
    },
  ]);

}

function canCall(serviceName) {
  if (mockLambda) {
    return mockLambda.canCall(serviceName);
  }
  // TODO: for now we use HTTP for bus calls outside of tests. This can change in the future.
  return false;
}

module.exports = {
  call: call,
  canCall: canCall,
};
