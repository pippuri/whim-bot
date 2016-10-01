'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const AWS = require('aws-sdk');

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

/**
 * Remove active itinerary of identityId with thing sha
 * @param {UUID} identityId
 * @return {Promise} updateThingShadowAsync response
 * TODO change state of the itinerary and its legs here
 */
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
  return destroyActiveItinerary(event.identityId)
    .then(response => callback(null, response))
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
