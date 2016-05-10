var Promise = require('bluebird');

var AWS = require('aws-sdk');
var lambda = new AWS.Lambda({ region:process.env.AWS_REGION });
Promise.promisifyAll(lambda, { suffix:'Promise' });

var wrap = require('lambda-wrapper').wrap;

var providerRegions = {
  tripgo: [
    {
      area:[59.74, 22.65, 61.99, 30.24],
      subProvider: '-southfinland',
    },
    {
      area: [59.74, 19.31, 64.12, 29.93],
      subProvider: '-middlefinland',
    },
    {
      area: [61.72, 20, 70.36, 32.08],
      subProvider: '-northfinland',
    },
  ],
};

function isInsideRegion(coords, area) {
  return (area[0] <= coords[0] && coords[0] <= area[2] &&
    area[1] <= coords[1] && coords[1] <= area[3]);
}

function chooseProviderByRegion(provider, from) {
  var subProvider = '';
  var regions = providerRegions[provider];
  if (regions) {
    var coords = from.split(',').map(parseFloat);

    // Look for a sub-provider by matching region
    regions.map(function (region) {
      if (!subProvider && isInsideRegion(coords, region.area)) {
        subProvider = region.subProvider;
      }

    });

    if (!subProvider) {

      // Could not find a subprovider in the configured regions
      throw new Error('No provider found for region');
    }
  }

  return subProvider;
}

function callRemoteLambda(functionName, event) {
  return lambda.invokePromise({
    FunctionName: functionName,
    Qualifier: process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev'),
    ClientContext: new Buffer(JSON.stringify({})).toString('base64'),
    Payload: JSON.stringify(event),
  });
}

function callLocalLambda(functionName, event) {

  var localLambdaMap = {
    'MaaS-provider-digitransit-routes': '../../provider-here/provider-here-routes/handler.js',
    'MaaS-provider-here-routes': '../../provider-here/provider-here-routes/handler.js',
    'MaaS-provider-tripgo-routes-middlefinland': '../../provider-tripgo/provider-tripgo-routes-middlefinland/handler.js',
    'MaaS-provider-tripgo-routes-northfinland': '../../provider-tripgo/provider-tripgo-routes-northfinland/handler.js',
    'MaaS-provider-tripgo-routes-southfinland': '../../provider-tripgo/provider-tripgo-routes-southfinland/handler.js',
  };

  return new Promise((resolve, reject) => {

    if (!localLambdaMap.hasOwnProperty(functionName)) {
      return reject(new Error('Missing local lambda mapping.'));
    }

    var handlerPath = localLambdaMap[functionName];
    var lambda = require(handlerPath);
    wrap(lambda).run(event, (err, data) => {
      if (err !== null) {
        return reject({
          Error: JSON.stringify(err),
        });
      }

      return resolve({
        Payload: JSON.stringify(data),
      });
    });
  });
}

function callLambda(functionName, event) {

  if (process.env.maas_test_run) {
    return callLocalLambda(functionName, event);
  }

  return callRemoteLambda(functionName, event);

}

module.exports = {

  getRoutes: (from, to, leaveAt, arriveBy, options) => {
    var provider;

    if (typeof options === typeof {} && options.hasOwnProperty('provider')) {
      provider = options.provider;
    } else {
      provider = 'tripgo';
    }

    var event = {
      from: from,
      to: to,
      leaveAt: leaveAt,
      arriveBy: arriveBy,
    };

    var subProvider = chooseProviderByRegion(provider, from);
    var functionName = 'MaaS-provider-' + provider + '-routes' + subProvider;

    return callLambda(functionName, event)
    .then(function (response) {
      var payload = JSON.parse(response.Payload);
      if (payload.error) {
        return Promise.reject(new Error(payload.error));
      } else if (payload.errorMessage) {
        return Promise.reject(new Error(payload.errorMessage));
      } else {

        // Add some debug info to response
        payload.maas = {
          provider: provider + subProvider,
        };
        return payload;
      }

    });

  },
};
