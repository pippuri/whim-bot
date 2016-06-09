const Promise = require('bluebird');
const AWS = require('aws-sdk');

const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });

Promise.promisifyAll(cognitoSync);

function saveDeviceToken(event) {

  var syncSessionToken;
  var patches = [];

  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new Error('400 Missing identityId'));
  }

  if (!event.hasOwnProperty('deviceToken') || event.deviceToken === '') {
    return Promise.reject(new Error('400 deviceToken missing from input'));
  }

  if (!event.hasOwnProperty('deviceName')) {
    return Promise.reject(new Error('400 deviceName missing from input'));
  }

  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: event.identityId,
    DatasetName: process.env.COGNITO_USER_DEVICES_DATASET,
  })
  .then(response => {
    syncSessionToken = response.SyncSessionToken;
    var oldRecords = {};
    response.Records.map(record => {
      oldRecords[record.Key] = record;
    });

    var device = {};
    device[event.deviceToken] = event.deviceName;

    Object.keys(device).map(key => {
      var oldRecord = oldRecords[key];
      var newValue;

      newValue = typeof device[key] === 'object' ? JSON.stringify(device[key]) : '' + device[key];

      // Check if changed
      if (!oldRecord || newValue !== oldRecord.Value) {
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

    return Promise.reject(new Error('500: Device existed, abort'));

  });

}

module.exports.respond = (event, callback) => {
  saveDeviceToken(event)
  .then(response => {
    callback(null, response);
  })
  .catch(error => {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(error);
  });

};
