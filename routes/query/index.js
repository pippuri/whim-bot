var Promise = require('bluebird');
var AWS = require('aws-sdk');
var lambda = new AWS.Lambda({region:process.env.AWS_REGION});
Promise.promisifyAll(lambda, {suffix:'Promise'});

var providerRegions = {
  tripgo: [
    {
      area:[59.74, 22.65, 61.99, 30.24],
      subProvider: '-southfinland'
    },
    {
      area: [59.74, 19.31, 64.12, 29.93],
      subProvider: '-middlefinland'
    },
    {
      area: [61.72, 20, 70.36, 32.08],
      subProvider: '-northfinland'
    }
  ]
};

function isInsideRegion(coords, area) {
  return (area[0] <= coords[0] && coords[0] <= area[2]
   && area[1] <= coords[1] && coords[1] <= area[3]);
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

function getRoutes(provider, from, to, leaveAt, arriveBy) {
  if (!provider) {
    provider = 'tripgo';
  }
  var subProvider = chooseProviderByRegion(provider, from);
  var functionName = 'MaaS-provider-' + provider + '-routes' + subProvider;
  console.log('Invoking router', functionName);
  return lambda.invokePromise({
    FunctionName: functionName,
    Qualifier: process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev'),
    ClientContext: new Buffer(JSON.stringify({})).toString('base64'),
    Payload: JSON.stringify({
      from: from,
      to: to,
      leaveAt: leaveAt,
      arriveBy: arriveBy
    })
  })
  .then(function (response) {
    var payload = JSON.parse(response.Payload);
    if (payload.error) {
      return Promise.reject(new Error(payload.error));
    } else if (payload.errorMessage) {
      return Promise.reject(new Error(payload.errorMessage));
    } else {
      // Add some debug info to response
      payload.maas = {
        provider: provider + subProvider
      };
      return payload;
    }
  });
}

module.exports.respond = function (event, callback) {
  getRoutes(event.provider, event.from, event.to, event.leaveAt, event.arriveBy)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
