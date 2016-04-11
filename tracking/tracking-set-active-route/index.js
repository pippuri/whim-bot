var Promise = require('bluebird');
var AWS = require('aws-sdk');

var iotData = new AWS.IotData({region:process.env.AWS_REGION, endpoint:process.env.IOT_ENDPOINT});
Promise.promisifyAll(iotData);

function setActiveRoute(principalId, activeRoute) {
  console.log('Activating user', principalId, 'route', activeRoute);
  var thingName = principalId.replace(/:/, '-');
  var payload = JSON.stringify({
    state: {
      reported: {
        activeRoute: activeRoute
      }
    }
  });
  console.log('Thing shadow payload:', payload);
  return iotData.updateThingShadowAsync({
    thingName: thingName,
    payload: payload
  })
  .then(function (response) {
    var payload = JSON.parse(response.payload);
    return payload.state.reported.activeRoute;
  });
}

module.exports.respond = function (event, callback) {
  setActiveRoute(''+event.principalId, event.activeRoute)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
