var Promise = require('bluebird');
var AWS = require('aws-sdk');

var cognitoIdentity = new AWS.CognitoIdentity();
var cognitoSync = new AWS.CognitoSync();
Promise.promisifyAll(cognitoIdentity);
Promise.promisifyAll(cognitoSync);

function getMqttCredentials(identityId) {

  // var token = ''; - not in use
  return Promise.resolve()
  .then(function () {

    // Get identity login token
    return cognitoSync.listRecordsAsync({
      IdentityPoolId: process.env.COGNITO_POOL_ID,
      IdentityId: identityId,
      DatasetName: process.env.COGNITO_PROFILE_DATASET,
    });
  })
  .then(function (response) {
    var plainPhone = '';
    response.Records.map(function (record) {
      console.log('Considering', record);
      if (record.Key === 'phone') {
        plainPhone = record.Value.replace(/[^\d]/g, '');
      }
    });

    // Get cognito token
    var logins = {};
    logins[process.env.COGNITO_DEVELOPER_PROVIDER] = 'tel:' + plainPhone;
    console.log('Identity logins:', logins);
    return cognitoIdentity.getOpenIdTokenForDeveloperIdentityAsync({
      IdentityPoolId: process.env.COGNITO_POOL_ID,
      IdentityId: identityId,
      Logins: logins,
    });
  })
  .then(function (response) {

    // Get credentials using the token
    return cognitoIdentity.getCredentialsForIdentityAsync({
      IdentityId: identityId,
      Logins: {
        'cognito-identity.amazonaws.com': response.Token,
      },
    });
  })
  .then(function (response) {
    response.IotEndpoint = process.env.IOT_ENDPOINT;
    response.ThingName = identityId.replace(/:/g, '-');
    return response;
  });
}

module.exports.respond = function (event, callback) {
  getMqttCredentials('' + event.identityId)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
