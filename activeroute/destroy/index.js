var Promise = require('bluebird');
var AWS = require('aws-sdk');

var iotData = new AWS.IotData({region:process.env.AWS_REGION, endpoint:process.env.IOT_ENDPOINT});
Promise.promisifyAll(iotData);

function destroyActiveRoute(principalId) {
  var thingName = principalId.replace(/:/, '-');
  return iotData.updateThingShadowAsync({
    thingName: thingName,
    payload: JSON.stringify({
      state: {
        reported: {
          itinerary: null
        }
      }
    })
  });
}

module.exports.respond = function (event, callback) {
  destroyActiveRoute(''+event.principalId)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
