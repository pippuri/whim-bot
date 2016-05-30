
const lambda = (process.env.maas_test_run) ? require('./mockLambda.js') : require('./lambda.js');
const dynamo = (process.env.maas_test_run) ? require('./mockDynamo.js') : require('./dynamo.js');

function call(serviceName, event) {
  switch (serviceName) {
    case 'Dynamo-get':
      return dynamo.getAsync(event);
    case 'Dynamo-put':
      return dynamo.putAsync(event);
    case 'Dynamo-update':
      return dynamo.updateAsync(event);
    case 'Dynamo-query':
      return dynamo.queryAsync(event);
    default:

    // Fall through to execute Lambda
  }

  return lambda.invokePromise(serviceName, event);
}

module.exports = {
  call: call,
};
