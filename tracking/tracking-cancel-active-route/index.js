var Promise = require('bluebird');
var AWS = require('aws-sdk');

var iotData = new AWS.IotData({ region:process.env.AWS_REGION, endpoint:process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function destroyActiveRoute(identityId) {
  var thingName = identityId.replace(/:/, '-');
  return iotData.updateThingShadowAsync({
    thingName: thingName,
    payload: JSON.stringify({
      state: {
        reported: {
          activeRoute: null,
        },
      },
    }),
  });
}

module.exports.respond = function (event, callback) {
  destroyActiveRoute('' + event.identityId)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
