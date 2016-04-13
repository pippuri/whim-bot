var Promise = require('bluebird');
var AWS = require('aws-sdk');

var iotData = new AWS.IotData({ region:process.env.AWS_REGION, endpoint:process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function getActiveRoute(principalId) {
  var thingName = principalId.replace(/:/, '-');
  return iotData.getThingShadowAsync({
    thingName: thingName,
  })
  .then(function (response) {
    var payload = JSON.parse(response.payload);
    if (payload && payload.state && payload.state.reported && payload.state.reported.activeRoute) {
      return payload.state.reported.activeRoute;
    } else {
      return Promise.reject(new Error('404 No Active Route'));
    }
  });
}

module.exports.respond = function (event, callback) {
  getActiveRoute('' + event.principalId)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
