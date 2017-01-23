'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const MaaSError = require('../../lib/errors/MaaSError');
const validator = require('../../lib/validator');
const requestSchema = require('maas-schemas/prebuilt/maas-backend/profile/profile-devices-put/request.json');

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

    // Check if old device data exists to get the previous sync count
    const oldRecord = response.Records.find(record => record.Key === event.payload.deviceIdentifier);

    // Input device updates
    const devices = {};
    devices[event.payload.deviceIdentifier] = {
      devicePushToken: event.payload.devicePushToken.replace(/\s/g, ''),
      deviceType: event.payload.deviceType,
    };

    // Try to parse the new format
    // then compare old and new tokens
    try {
      // Should the record in old format, either 1 of the following 2 lines should throw Error.
      const devicePushToken = JSON.parse(oldRecord.Value).devicePushToken;
      if (!devicePushToken) throw new Error('Old device not having device push token');

      // Check if token is unchanged, skip update
      if (oldRecord && devices[event.payload.deviceIdentifier].devicePushToken === JSON.parse(oldRecord.Value).devicePushToken) {
        return Promise.resolve('Input device push token unchanged, skip update');
      }
    // Should any error happens, it should be because of the old format
    } catch (error) {
      console.info(error);
      // Not in the new format, fallback
      console.info('Detect old device record format, fallback to auto format');
      if (oldRecord && devices[event.payload.deviceIdentifier].devicePushToken === oldRecord.devicePushToken) {
        console.info('Input device push token unchanged, update format only');
      } else {
        console.info('Updating both token and format');
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
