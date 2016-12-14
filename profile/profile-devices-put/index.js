'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const MaaSError = require('../../lib/errors/MaaSError');

const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });

Promise.promisifyAll(cognitoSync);

function validateInput(event) {
  if (!event.identityId) return Promise.reject(new MaaSError('Missing identityId', 400));
  if (!event.payload) return Promise.reject(new MaaSError('Missing Payload', 400));
  if (!event.payload.devicePushToken) return Promise.reject(new MaaSError('devicePushToken missing from payload', 400));
  if (!event.payload.deviceIdentifier) return Promise.reject(new MaaSError('deviceIdentifier missing from payload', 400));
  if (!event.payload.deviceType) return Promise.reject(new MaaSError('deviceType missing from payload', 400));
  return Promise.resolve();
}

function saveDeviceToken(event) {

  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: event.identityId,
    DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
  })
  .then(response => {
    const syncSessionToken = response.SyncSessionToken;

    // Old records
    const oldRecords = response.Records.map(record => {
      const tmp = {};
      tmp[record.Key] = record;
      return tmp;
    });

    // Input device updates
    const devices = {};
    devices[event.payload.deviceIdentifier] = {
      devicePushToken: event.payload.devicePushToken.replace(/\s/g, ''),
      deviceType: event.payload.deviceType,
    };

    // check if old device data exists to get the previous sync count
    const oldRecord = oldRecords.find(record => record.Key === event.payload.deviceIdentifier);

    // If old push token === new push token, skip update
    if (oldRecord && devices[event.payload.deviceIdentifier].devicePushToken === JSON.parse(oldRecord.Value).devicePushToken) {
      return Promise.resolve('Input device push token unchanged, skip update');
    }

    return cognitoSync.updateRecordsAsync({
      IdentityPoolId: process.env.COGNITO_POOL_ID,
      IdentityId: event.identityId,
      DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
      SyncSessionToken: syncSessionToken,
      RecordPatches: [
        {
          Op: 'replace',
          Key: event.payload.deviceIdentifier,
          Value: JSON.stringify(devices[event.payload.deviceIdentifier]),
          SyncCount: oldRecord ? oldRecord.SyncCount : 0,
        },
      ],
    });
  });
}

module.exports.respond = (event, callback) => {
  return validateInput(event)
    .then(() => saveDeviceToken(event))
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
