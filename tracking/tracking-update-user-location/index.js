'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const AWS = require('aws-sdk');

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

function updateUserLocation(identityId, lat, lon, timestamp, legId) {

  const thingName = identityId.replace(/:/, '-');
  const payload = JSON.stringify({
    state: {
      reported: {
        location: {
          lat: lat,
          lon: lon,
          timestamp: timestamp,
          legId: legId,
        },
      },
    },
  });

  return iotData.updateThingShadowAsync({
    thingName: thingName,
    payload: payload,
  });
}

module.exports.respond = function (event, callback) {
  return Promise.resolve()
    .then(() => updateUserLocation(event.identityId, event.lat, event.lon, event.timestamp, event.legId))
  .then(response => {
    callback(null, response);
  })
  .catch(_error => {
    console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    if (_error instanceof MaaSError) {
      callback(_error);
      return;
    }

    callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
  });
};
