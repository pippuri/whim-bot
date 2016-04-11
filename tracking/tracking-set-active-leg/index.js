var Promise = require('bluebird');
var AWS = require('aws-sdk');

var iotData = new AWS.IotData({region:process.env.AWS_REGION, endpoint:process.env.IOT_ENDPOINT});
Promise.promisifyAll(iotData);

function setActiveRouteLeg(principalId, legId, timestamp) {
  var thingName = principalId.replace(/:/, '-');
  var payload = JSON.stringify({
    state: {
      reported: {
        activeRoute: {
          leg: {
            legId: legId,
            timestamp: timestamp
          }
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
  setActiveRoute(''+event.principalId, event.legId, event.timestamp)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
