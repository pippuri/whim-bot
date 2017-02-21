'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const AWS = require('aws-sdk');

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });

/**
 * Return active itinerary data from thing shadow
 * @param  {UUID} identityId
 * @return {Object} itinerary
 */
function getActiveItinerary(identityId) {
  const thingName = identityId.replace(/:/, '-');
  return iotData.getThingShadow({
    thingName: thingName,
  }).promise()
  .then(response => {
    const payload = JSON.parse(response.payload);
    if (payload && payload.state && payload.state.reported && payload.state.reported.itinerary && payload.state.reported.itinerary.state) {
      return payload.state.reported.itinerary;
    }

    return Promise.reject(new MaaSError('No Active Itinerary', 404));
  });
}

module.exports.respond = function (event, callback) {
  return Promise.resolve()
    .then(() => getActiveItinerary(event.identityId))
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
