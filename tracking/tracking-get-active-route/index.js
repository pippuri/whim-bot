var Promise = require('bluebird');
var AWS = require('aws-sdk');

var iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function getActiveRoute(identityId) {
  var thingName = identityId.replace(/:/, '-');
  return iotData.getThingShadowAsync({
    thingName: thingName,
  })
  .then(function (response) {
    var payload = JSON.parse(response.payload);
    if (payload && payload.state && payload.state.reported && payload.state.reported.activeRoute) {
      return payload.state.reported.activeRoute;
    }

    return Promise.reject(new Error('404 No Active Route'));
  });
}

module.exports.respond = function (event, callback) {
  getActiveRoute('' + event.identityId)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
