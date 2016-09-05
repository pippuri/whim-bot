'use strict';

const _case = require('case-expression');
const _default = () => true;

const lambda = require('./lambda.js');
const mockLambda = (process.env.maas_test_run) ? require('./mockLambda.js') : null;
const dynamo = (process.env.maas_test_run) ? require('./mockDynamo.js') : require('./dynamo.js');

function call(serviceName, event) {

  return _case(serviceName, [

    'Dynamo-get', () => {
      return dynamo.getAsync(event);
    },

    'Dynamo-put', () => {
      return dynamo.putAsync(event);
    },

    'Dynamo-update', () => {
      return dynamo.updateAsync(event);
    },

    'Dynamo-query', () => {
      return dynamo.queryAsync(event);
    },

    _default, () => {
      if (mockLambda && mockLambda.canCall(serviceName) ) {
        return mockLambda.invokePromise(serviceName, event);
      }
      return lambda.invokePromise(serviceName, event);
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
