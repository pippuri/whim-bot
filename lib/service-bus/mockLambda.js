const wrap = require('lambda-wrapper').wrap;
const Promise = require('bluebird');

const localLambdaMap = {
  'MaaS-provider-digitransit-routes': '../../provider-here/provider-here-routes/handler.js',
  'MaaS-provider-here-routes': '../../provider-here/provider-here-routes/handler.js',
  'MaaS-provider-tripgo-routes-middlefinland': '../../provider-tripgo/provider-tripgo-routes-middlefinland/handler.js',
  'MaaS-provider-tripgo-routes-northfinland': '../../provider-tripgo/provider-tripgo-routes-northfinland/handler.js',
  'MaaS-provider-tripgo-routes-southfinland': '../../provider-tripgo/provider-tripgo-routes-southfinland/handler.js',
  'MaaS-profile-info': '../../profile/profile-info/handler.js',
  'MaaS-profile-edit': '../../profile/profile-edit/handler.js',
  'MaaS-provider-here-autocomplete': '../../provider-here/provider-here-autocomplete/handler.js',
};

function invokePromise(functionName, event) {
  return new Promise((resolve, reject) => {
    if (!localLambdaMap.hasOwnProperty(functionName)) {
      return reject(new Error('Missing local lambda mapping for ' + functionName + '.'));
    }

    const handlerPath = localLambdaMap[functionName];
    const lambda = require(handlerPath);

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
}

module.exports = {
  invokePromise: invokePromise,
};