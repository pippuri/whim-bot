const Promise = require('bluebird');
const AWS = require('aws-sdk');

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function getActiveItinerary(identityId) {
  const thingName = identityId.replace(/:/, '-');
  return iotData.getThingShadowAsync({
    thingName: thingName,
  })
  .then(response => {
    const payload = JSON.parse(response.payload);
    if (payload && payload.state && payload.state.reported && payload.state.reported.itinerary) {
      return payload.state.reported.itinerary;
    }

    return Promise.reject(new Error('404 No Active Itinerary'));
  });
}

module.exports.respond = function (event, callback) {
  getActiveItinerary(event.identityId)
  .then(response => callback(null, response))
  .catch(err => {
    console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
    callback(err);
  });
};
