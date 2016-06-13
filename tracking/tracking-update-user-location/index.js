'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');

var iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function updateUserLocation(identityId, legId, lat, lon, timestamp) {
  var thingName = identityId.replace(/:/, '-');
  var payload = JSON.stringify({
    state: {
      reported: {
        location: {
          legId: legId,
          lat: lat,
          lon: lon,
          timestamp: timestamp,
        },
      },
    },
  });
  console.log('Thing shadow payload:', payload);
  return iotData.updateThingShadowAsync({
    thingName: thingName,
    payload: payload,
  });
}

module.exports.respond = function (event, callback) {
  updateUserLocation('' + event.identityId, '' + event.legId, event.lat, event.lon, event.timestamp)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
