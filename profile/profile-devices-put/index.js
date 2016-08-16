'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const MaasError = require('../../lib/errors/MaaSError');

const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });

Promise.promisifyAll(cognitoSync);

function saveDeviceToken(event) {

  let syncSessionToken;
  const patches = [];

  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaasError('Missing identityId', 400));
  }

  if (!event.hasOwnProperty('payload')) {
    return Promise.reject(new MaasError('Missing Payload', 400));
  }

  if (!event.payload.hasOwnProperty('devicePushToken') || event.payload.devicePushToken === '') {
    return Promise.reject(new MaasError('devicePushToken missing from payload', 400));
  }

  if (!event.payload.hasOwnProperty('deviceIdentifier')) {
    return Promise.reject(new MaasError('deviceIdentifier missing from payload', 400));
  }

  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: event.identityId,
    DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
  })
  .then(response => {
    syncSessionToken = response.SyncSessionToken;
    const oldRecords = {};
    response.Records.map(record => {
      oldRecords[record.Key] = record;
    });

    const device = {};
    device[event.payload.deviceIdentifier] = event.payload.devicePushToken.replace(/\s/g, '');

    Object.keys(device).map(key => {
      const oldRecord = oldRecords[key];

      const newValue = typeof device[key] === 'object' ? JSON.stringify(device[key]) : '' + device[key];

      // Check if changed
      if (!oldRecord || newValue !== oldRecord.Key) {
        patches.push({
          Op: 'replace',
          Key: key,
          Value: newValue,
          SyncCount: oldRecord ? oldRecord.SyncCount : 0,
        });
      }

    });

    if (patches.length > 0) {
      return cognitoSync.updateRecordsAsync({
        IdentityPoolId: process.env.COGNITO_POOL_ID,
        IdentityId: event.identityId,
        DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
        SyncSessionToken: syncSessionToken,
        RecordPatches: patches,
      });
    }

    return Promise.resolve('Device existed, nothing changed');

  });

}

module.exports.respond = (event, callback) => {
  saveDeviceToken(event)
  .then(response => {
    callback(null, response);
  })
  .catch(error => {
    console.info('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(error);
  });

};
