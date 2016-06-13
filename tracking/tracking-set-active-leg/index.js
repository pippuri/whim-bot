'use strict';

var Promise = require('bluebird');
var AWS = require('aws-sdk');

var iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
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

function setActiveLeg(identityId, itinerary, legId, timestamp) {
  if (!legId) {
    return Promise.reject(new Error('400 id is required'));
  }

  if (!timestamp) {
    return Promise.reject(new Error('400 timestamp is required'));
  }

  var thingName = identityId.replace(/:/, '-');
  var payload = JSON.stringify({
    state: {
      reported: {
        itinerary: {
          id: itinerary.id,
          timestamp: itinerary.timestamp,
          leg: {
            id: legId,
            timestamp: timestamp,
          },
        },
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
    return payload.state.reported.itinerary && payload.state.reported.itinerary.leg || null;
  });
}

module.exports.respond = function (event, callback) {
  getActiveItinerary(event.identityId)
  .then(itinerary => {
    return setActiveLeg(event.identityId, itinerary, event.leg.id, event.leg.timestamp);
  })
  .then(response => {
    callback(null, response);
  })
  .catch(err => {
    console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
    callback(err);
  });
};
