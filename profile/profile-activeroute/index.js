var Promise = require('bluebird');
var AWS = require('aws-sdk');

var cognitoSync = new AWS.CognitoSync({ region:process.env.AWS_REGION });

Promise.promisifyAll(cognitoSync);

function savesUserActiveRoute(identityId, timestamp, activeroute) {

  var syncSessionToken;
  var patches = [];

  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: identityId,
    DatasetName: process.env.COGNITO_ACTIVEROUTES_DATASET,
  })
  .then(function (response) {
    syncSessionToken = response.SyncSessionToken;
    var oldRecords = {};
    response.Records.map(function (record) {
      oldRecords[record.Key] = record;
    });

    var activeroutes = {
      timestamp: timestamp,
      activeroute: activeroute,
    };

    Object.keys(activeroutes).map(function (key) {
      var oldRecord = oldRecords[key];
      var newValue;
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

  });
}

module.exports.respond = function (event, callback) {
  savesUserActiveRoute('' + event.identityId, event.timestamp, event.active_route)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });

};
