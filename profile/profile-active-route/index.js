'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const MaaSError = require('../../lib/errors/MaaSError');

const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });

Promise.promisifyAll(cognitoSync);

function savesUserActiveRoute(identityId, timestamp, activeroute) {

  let syncSessionToken;
  const patches = [];

  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: identityId,
    DatasetName: process.env.COGNITO_ACTIVEROUTES_DATASET,
  })
  .then(response => {
    syncSessionToken = response.SyncSessionToken;
    const oldRecords = {};
    response.Records.map(record => {
      oldRecords[record.Key] = record;
    });

    const activeroutes = {
      timestamp: timestamp,
      activeroute: activeroute,
    };

    Object.keys(activeroutes).map(key => {
      const oldRecord = oldRecords[key];
      let newValue;
      if (typeof activeroutes[key] === 'object') {
        newValue = JSON.stringify(activeroutes[key]);
      } else {
        newValue = '' + activeroutes[key];
      }

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
        IdentityId: identityId,
        DatasetName: process.env.COGNITO_PROFILE_DATASET,
        SyncSessionToken: syncSessionToken,
        RecordPatches: patches,
      });
    }

    return Promise.resolve();
  });
}

module.exports.respond = function (event, callback) {
  savesUserActiveRoute('' + event.identityId, event.timestamp, event.active_route)
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
