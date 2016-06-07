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
  'MaaS-profile-create': '../../profile/profile-create/handler.js',
  'MaaS-store-single-package': '../../store/store-single-package/handler.js',
  'MaaS-provider-here-autocomplete': '../../provider-here/provider-here-autocomplete/handler.js',
  'MaaS-provider-google-reverse-geocoding': '../../provider-google/provider-google-reverse-geocoding/handler.js',
};

function invokePromise(functionName, event) {
  return new Promise((resolve, reject) => {
    if (!localLambdaMap.hasOwnProperty(functionName)) {
      reject(new Error('Missing local lambda mapping for ' + functionName + '.'));
      return;
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
