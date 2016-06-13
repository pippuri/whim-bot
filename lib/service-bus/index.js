'use strict';

const _case = require('case-expression');
const _default = () => true;

const lambda = (process.env.maas_test_run) ? require('./mockLambda.js') : require('./lambda.js');
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
      return lambda.invokePromise(serviceName, event);
    },

  ]);

}

module.exports = {
  call: call,
};
