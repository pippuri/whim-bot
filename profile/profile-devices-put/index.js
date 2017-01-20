'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const MaaSError = require('../../lib/errors/MaaSError');
const validator = require('../../lib/validator');
const requestSchema = require('maas-schemas/prebuilt/maas-backend/profile/profile-devices-put/request.json');
const responseSchema = require('maas-schemas/prebuilt/maas-backend/profile/profile-devices-put/response.json');

const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });

Promise.promisifyAll(cognitoSync);

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
      return record;
    });
    // Input device updates
    const devices = {};
    devices[event.payload.deviceIdentifier] = {
      devicePushToken: event.payload.devicePushToken.replace(/\s/g, ''),
      deviceType: event.payload.deviceType,
    };

    // check if old device data exists to get the previous sync count
    const oldRecord = oldRecords.find(record => record.Key === event.payload.deviceIdentifier);

    try {
      const devicePushToken = JSON.parse(oldRecord.Value).devicePushToken;
      if (!devicePushToken) throw new Error('Old device format detected');
      if (oldRecord && devices[event.payload.deviceIdentifier].devicePushToken === JSON.parse(oldRecord.Value).devicePushToken) {
        return Promise.resolve('Input device push token unchanged, skip update');
      }
    } catch (error) {
      // Not in the new format, fallback
      console.warn('[Push notification] Detect old device record format, fallback to auto format');
      if (oldRecord && devices[event.payload.deviceIdentifier].devicePushToken === oldRecord.devicePushToken) {
        console.info('Input device push token unchanged, update format only');
      }
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
  return validator.validate(requestSchema, event, { coerceTypes: true, useDefaults: true, sanitize: true })
    .then(() => saveDeviceToken(event))
    .then(response => {
      return validator.validate(responseSchema, response)
        .catch(error => {
          console.warn('[Push Notification] Warning; Response validation failed, but responding with success');
          console.warn('[Push Notification] Errors:', error.message);
          console.warn('[Push Notification] Response:', JSON.stringify(error.object, null, 2));
          return Promise.resolve(response);
        });
    })
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
