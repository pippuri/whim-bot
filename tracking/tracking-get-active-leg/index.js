'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const MaaSError = require('../../lib/errors/MaaSError');

const iotData = new AWS.IotData({ region: process.env.AWS_REGION, endpoint: process.env.IOT_ENDPOINT });
Promise.promisifyAll(iotData);

/**
 * Return the activeLeg Id related to this identityId
 * @param {UUID} identityId
 * @return {String} legId
 * TODO Return the whole leg.
 */
function getActiveLegId(identityId) {
  const thingName = identityId.replace(/:/, '-');
  return iotData.getThingShadowAsync({
    thingName,
  })
  .then(response => {
    const payload = JSON.parse(response.payload);
    console.log(payload.state.reported.location.legId);
    if (payload.state.reported.location.legId) {
      return payload.state.reported.location.legId;
    }

    return Promise.reject(new MaaSError('No Active Leg', 404));
  });
}

module.exports.respond = function (event, callback) {
  return getActiveLegId(event.identityId)
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      callback(error);
    });
};
