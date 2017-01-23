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
  .then(records => {
    const syncSessionToken = records.SyncSessionToken;
    const newRecord = {
      Key: event.payload.deviceIdentifier,
      Value: {
        devicePushToken: event.payload.devicePushToken.replace(/\s/g, ''),
        deviceType: event.payload.deviceType,
      },
    };

    // Check if old device data exists to get the previous sync count
    const oldRecord = records.Records.find(record => record.Key === newRecord.Key);
    let tokenChanged = false;

    // Try to parse the new format; then compare old and new tokens
    try {
      // Fail in case of no record found
      if (!oldRecord) {
        throw new Error(`No record for the device ${newRecord.Key} exists.`);
      }

      // Should the record be in old format, either 1 of the following 2 lines
      // should throw an Error.
      const oldRecordNewFormat = {
        Key: oldRecord.Key,
        Value: JSON.parse(oldRecord.Value),
      };

      const oldToken = oldRecordNewFormat.Value.devicePushToken;
      if (!oldToken || oldToken !== newRecord.Value.devicePushToken) {
        tokenChanged = true;
      }
    } catch (error) {
      // Should any error happen, it should be because of the old format or
      // missing record for this device -> create a record
      console.info(`Force-refreshing a device token ${newRecord.Key}, reason: ${error.message}`);

      tokenChanged = true;
    }

    // Create the response we can serve
    const device = Object.assign({ deviceIdentifier: newRecord.Key }, newRecord.Value);

    // Check if synchronization to new token if needed - if not, return;
    if (!tokenChanged) {
      console.info('Token not changed, skipping update.');
      return Promise.resolve(device);
    }

    console.info('Token changed, updating Cognito devices.');
    return cognitoSync.updateRecordsAsync({
      IdentityPoolId: process.env.COGNITO_POOL_ID,
      IdentityId: event.identityId,
      DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
      SyncSessionToken: syncSessionToken,
      RecordPatches: [
        {
          Op: 'replace',
          Key: newRecord.Key,
          Value: JSON.stringify(newRecord.Value),
          SyncCount: oldRecord ? oldRecord.SyncCount : 0,
        },
      ],
    })
    .then(() => device);
  });
}

function formatResponse(device) {
  return {
    device: device,
    debug: {},
  };
}

module.exports.respond = (event, callback) => {
  return validator.validate(requestSchema, event, { coerceTypes: true, useDefaults: true, sanitize: true })
    .then(() => saveDeviceToken(event))
    .then(device => callback(null, formatResponse(device)))
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
