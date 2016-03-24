var Promise = require('bluebird');
var AWS = require('aws-sdk');

var iotData = new AWS.IotData({region:process.env.AWS_REGION, endpoint:process.env.IOT_ENDPOINT});
Promise.promisifyAll(iotData);

function setActiveRoute(principalId, itinerary) {
  var thingName = principalId.replace(/:/, '-');
  var payload = JSON.stringify({
    state: {
      reported: {
        itinerary: itinerary
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
  setActiveRoute(''+event.principalId, event.itinerary)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
