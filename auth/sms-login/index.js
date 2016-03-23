var Promise = require('bluebird');
var crypto = require('crypto');
var AWS = require('aws-sdk');
var jwt = require('jsonwebtoken');

var cognitoIdentity = new AWS.CognitoIdentity({region:process.env.AWS_REGION});
var cognitoSync = new AWS.CognitoSync({region:process.env.AWS_REGION});

Promise.promisifyAll(cognitoIdentity);
Promise.promisifyAll(cognitoSync);

/**
 * Create or retrieve Amazon Cognito identity.
 */
function getCognitoDeveloperIdentity(plainPhone) {
  // Use sha1 hash of subscriberId because it may contain spaces, which are not allowed in Cognito
  var logins = {};
  logins[process.env.COGNITO_DEVELOPER_PROVIDER] = 'tel:' + plainPhone;
  var options = {
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    Logins: logins
  };
  console.log('Getting cognito developer identity with', JSON.stringify(options, null, 2));
  return cognitoIdentity.getOpenIdTokenForDeveloperIdentityAsync(options)
  .then(function (response) {
    return response.IdentityId;
  });
}

/**
 * Create or update Amazon Cognito profile dataset.
 */
function updateCognitoProfile(principalId, profile) {
  var syncSessionToken;
  var patches = [];
  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: principalId,
    DatasetName: process.env.COGNITO_PROFILE_DATASET,
  })
  .then(function (response) {
    syncSessionToken = response.SyncSessionToken;
    var oldRecords = {};
    response.Records.map(function (record) {
      oldRecords[record.Key] = record;
    });
    Object.keys(profile).map(function (key) {
      var oldRecord = oldRecords[key];
      var newValue;
      if (typeof profile[key] == 'object') {
        newValue = JSON.stringify(profile[key]);
      } else {
        newValue = ''+profile[key];
      }
      // Check if changed
      if (!oldRecord || newValue != oldRecord.Value) {
        patches.push({
          Op: 'replace',
          Key: key,
          Value: newValue,
          SyncCount: oldRecord ? oldRecord.SyncCount : 0
        });
      }
    });
    if (patches.length > 0) {
      return cognitoSync.updateRecordsAsync({
        IdentityPoolId: process.env.COGNITO_POOL_ID,
        IdentityId: principalId,
        DatasetName: process.env.COGNITO_PROFILE_DATASET,
        SyncSessionToken: syncSessionToken,
        RecordPatches: patches
      });
    }
  });
}

/**
 * Login using a verification code sent by SMS.
 */
function smsLogin(phone, code) {
  var plainPhone = phone.replace(/[^\d]/g, '');
  if (!plainPhone || plainPhone.length < 4) {
    return Promise.reject(new Error('Invalid phone number'));
  }
  var shasum = crypto.createHash('sha1');
  var salt = code.slice(0, 3);
  shasum.update(salt + process.env.SMS_CODE_SECRET + plainPhone);
  var hash = shasum.digest('hex');
  var correctCode = salt + '' + (100+parseInt(hash.slice(0, 3), 16));
  console.log('Verifying SMS code', code, 'for', phone, 'plainphone', plainPhone, 'correct', correctCode);
  if (correctCode !== code) {
    return Promise.reject(new Error('401 Unauthorized'));
  }
  var principalId;
  return getCognitoDeveloperIdentity(plainPhone)
  .then(function (identityId) {
    principalId = identityId;
    return updateCognitoProfile(principalId, {
      phone: phone,
      verificationCode: code
    });
  })
  .then(function () {
    // Create a signed JSON web token
    var token = jwt.sign({
      id: principalId
    }, process.env.JWT_SECRET);
    return {
      id_token: token
    };
  });
}

module.exports.respond = function (event, callback) {
  smsLogin(''+event.phone, ''+event.code)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
