'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const AWS = require('aws-sdk');

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });

/**
 * Remove active itinerary of identityId with thing sha
 * @param {UUID} identityId
 * @return {Promise} updateThingShadowAsync response
 * TODO change state of the itinerary and its legs here
 */
function destroyActiveItinerary(identityId) {
  const thingName = identityId.replace(/:/, '-');

  return iotData.updateThingShadow({
    thingName: thingName,
    payload: JSON.stringify({
      state: {
        reported: {
          itinerary: null,
        },
      },
    }),
  }).promise();
}

module.exports.respond = function (event, callback) {
  return Promise.resolve()
    .then(() => destroyActiveItinerary(event.identityId))
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
