'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function setActiveItinerary(identityId, itinerary) {
  if (!itinerary.id) {
    return Promise.reject(new Error('400 id is required'));
  }

  if (!itinerary.timestamp) {
    return Promise.reject(new Error('400 timestamp is required'));
  }

  console.log(`Activating user ${identityId} itinerary ${itinerary}`);
  const thingName = identityId.replace(/:/, '-');
  const payload = JSON.stringify({
    state: {
      reported: {
        itinerary: itinerary,
      },
    },
  });

  console.log(`Thing shadow payload: ${payload}`);
  return iotData.updateThingShadowAsync({
    thingName: thingName,
    payload: payload,
  })
  .then(response => {
    const payload = JSON.parse(response.payload);
    return payload.state.reported.itinerary;
  });
}

module.exports.respond = function (event, callback) {
  setActiveItinerary(event.identityId, event.itinerary)
  .then(response => {
    callback(null, response);
  })
  .catch(err => {
    console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
    callback(err);
  });
};
