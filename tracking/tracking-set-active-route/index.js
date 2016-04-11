var Promise = require('bluebird');
var AWS = require('aws-sdk');

var iotData = new AWS.IotData({region:process.env.AWS_REGION, endpoint:process.env.IOT_ENDPOINT});
Promise.promisifyAll(iotData);

function setActiveRoute(principalId, routeId, legId, itinerary, timestamp) {
  var thingName = principalId.replace(/:/, '-');
  var payload = JSON.stringify({
    state: {
      reported: {
        activeRoute: {
          routeId: routeId,
          legId: legId,
          itinerary: itinerary,
          timestamp: timestamp
        }
      }
    }
  });
  console.log('Thing shadow payload:', payload);
  return iotData.updateThingShadowAsync({
    thingName: thingName,
    payload: payload
  });
}

module.exports.respond = function (event, callback) {
  setActiveRoute(''+event.principalId, event.routeId, event.legId, event.itinerary, event.timestamp)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
