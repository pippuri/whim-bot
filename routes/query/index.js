var Promise = require('bluebird');
var AWS = require('aws-sdk');
var lambda = new AWS.Lambda({region:process.env.AWS_REGION});
Promise.promisifyAll(lambda, {suffix:'Promise'});

function getRoutes(provider, from, to) {
  if (!provider) {
    provider = 'tripgo';
  }
  var functionName = 'MaaS-provider-' + provider + '-routes';
  return lambda.invokePromise({
    FunctionName: functionName,
    Qualifier: process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev'),
    ClientContext: new Buffer(JSON.stringify({})).toString('base64'),
    Payload: JSON.stringify({
      from: from,
      to: to
    })
  })
  .then(function (response) {
    return JSON.parse(response.Payload);
  });
}

module.exports.respond = function (event, callback) {
  getRoutes(event.provider, event.from, event.to)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
