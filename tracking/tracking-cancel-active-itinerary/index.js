const Promise = require('bluebird');
const AWS = require('aws-sdk');

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function destroyActiveItinerary(identityId) {
  const thingName = identityId.replace(/:/, '-');

  return iotData.updateThingShadowAsync({
    thingName: thingName,
    payload: JSON.stringify({
      state: {
        reported: {
          itinerary: null,
        },
      },
    }),
  });
}

module.exports.respond = function (event, callback) {
  destroyActiveItinerary(event.identityId)
  .then(response => callback(null, response))
  .catch(err => {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
