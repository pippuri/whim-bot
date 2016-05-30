var Promise = require('bluebird');
var AWS = require('aws-sdk');

var iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function setActiveRoute(identityId, activeRoute) {
  if (!activeRoute.routeId) {
    return Promise.reject(new Error('400 routeId is required'));
  }

  if (!activeRoute.timestamp) {
    return Promise.reject(new Error('400 timestamp is required'));
  }

  if (!activeRoute.legs) {
    return Promise.reject(new Error('400 legs are required'));
  }

  if (!activeRoute.activeLeg) {
    return Promise.reject(new Error('400 activeLeg is required'));
  }

  if (!activeRoute.activeLeg.legId) {
    return Promise.reject(new Error('400 activeLeg.legId is required'));
  }

  if (!activeRoute.activeLeg.timestamp) {
    return Promise.reject(new Error('400 activeLeg.timestamp is required'));
  }

  console.log('Activating user', identityId, 'route', activeRoute);
  var thingName = identityId.replace(/:/, '-');
  var payload = JSON.stringify({
    state: {
      reported: {
        activeRoute: activeRoute,
      },
    },
  });
  console.log('Thing shadow payload:', payload);
  return iotData.updateThingShadowAsync({
    thingName: thingName,
    payload: payload,
  })
  .then(function (response) {
    var payload = JSON.parse(response.payload);
    return payload.state.reported.activeRoute;
  });
}

module.exports.respond = function (event, callback) {
  setActiveRoute('' + event.identityId, event.activeRoute)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
