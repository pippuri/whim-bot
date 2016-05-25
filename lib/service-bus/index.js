var Promise = require('bluebird');

var AWS = require('aws-sdk');
var lambda = new AWS.Lambda({ region: process.env.AWS_REGION });
Promise.promisifyAll(lambda, { suffix: 'Promise' });
var wrap = require('lambda-wrapper').wrap;
var docClient = new AWS.DynamoDB.DocumentClient();
Promise.promisifyAll(docClient);

var callLambda = (functionName, event) => lambda.invokePromise({
  FunctionName: functionName,
  Qualifier: process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev'),
  ClientContext: new Buffer(JSON.stringify({})).toString('base64'),
  Payload: JSON.stringify(event),
})
.then((response) => {
  var payload = JSON.parse(response.Payload);

  // Add some debug info to response
  payload.maas = {
    provider: functionName,
  };
  return payload;
});

if (process.env.maas_test_run) {
  callLambda = (functionName, event) => {

    var localLambdaMap = {
      'MaaS-provider-digitransit-routes': '../../provider-here/provider-here-routes/handler.js',
      'MaaS-provider-here-routes': '../../provider-here/provider-here-routes/handler.js',
      'MaaS-provider-tripgo-routes-middlefinland': '../../provider-tripgo/provider-tripgo-routes-middlefinland/handler.js',
      'MaaS-provider-tripgo-routes-northfinland': '../../provider-tripgo/provider-tripgo-routes-northfinland/handler.js',
      'MaaS-provider-tripgo-routes-southfinland': '../../provider-tripgo/provider-tripgo-routes-southfinland/handler.js',
      'MaaS-profile-info': '../../profile/profile-info/handler.js',
      'MaaS-provider-here-autocomplete': '../../provider-here/provider-here-autocomplete/handler.js',
    };

    return new Promise((resolve, reject) => {

      if (!localLambdaMap.hasOwnProperty(functionName)) {
        return reject(new Error('Missing local lambda mapping for ' + functionName + '.'));
      }

      var handlerPath = localLambdaMap[functionName];
      var lambda = require(handlerPath);
      wrap(lambda).run(event, (err, data) => {
        if (err !== null) {
          return reject(err);
        }

        return resolve(data);
      });
    })
    .then((payload) => {
      // Add some debug info to response
      payload.maas = {
        provider: 'local:' + functionName,
      };
      return payload;
    });
  };
}

var callDynamoGet = (params) => docClient.getAsync(params);
var callDynamoPut = (params) => docClient.putAsync(params);
var callDynamoUpdate = (params) => docClient.updateAsync(params);
var callDynamoQuery = (params) => docClient.queryAsync(params);

if (process.env.maas_test_run) {

  const testUsers = {
    'eu-west-1:00000000-cafe-cafe-cafe-000000000000': {
      Item: {
        plan: [],
        favLocation: [
          {
            lon: 231232,
            address: 'Great Chott salt flat, Tatooine',
            name: 'work',
            lat: 123123,
          },
        ],
        balance: 0,
        phone: '+358405103121',
        identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      },
    },
  };

  callDynamoGet = (params) => new Promise((resolve, reject) => {
    const identityId = params.Key.identityId;
    if (!testUsers.hasOwnProperty(identityId)) {
      resolve({});
    }

    const context = testUsers[identityId];
    resolve(context);
  });

  callDynamoPut = (params) => new Promise((resolve, reject) => {
    resolve({});
  });
}

module.exports = {

  call: (serviceName, event) => {

    if (serviceName === 'Dynamo-get') {
      return callDynamoGet(event);
    } else if (serviceName === 'Dynamo-put') {
      return callDynamoPut(event);
    } else if (serviceName === 'Dynamo-update') {
      return callDynamoUpdate(event);
    } else if (serviceName === 'Dynamo-query') {
      return callDynamoQuery(event);
    }

    return callLambda(serviceName, event)
    .then((payload) => {
      if (payload.error) {
        return Promise.reject(new Error(payload.error));
      }

      if (payload.errorMessage) {
        return Promise.reject(new Error(payload.errorMessage));
      }

      return payload;
    });
  },
};
