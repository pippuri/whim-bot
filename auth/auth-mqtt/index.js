'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');

const cognitoIdentity = new AWS.CognitoIdentity();
const cognitoSync = new AWS.CognitoSync();
Promise.promisifyAll(cognitoIdentity);
Promise.promisifyAll(cognitoSync);

function getMqttCredentials(principalId) {

  // const token = ''; - not in use
  return Promise.resolve()
  .then(() => {

    // Get identity login token
    return cognitoSync.listRecordsAsync({
      IdentityPoolId: process.env.COGNITO_POOL_ID,
      IdentityId: principalId,
      DatasetName: process.env.COGNITO_PROFILE_DATASET,
    });
  })
  .then(response => {
    let plainPhone = '';
    response.Records.map(record => {
      console.log('Considering', record);
      if (record.Key === 'phone') {
        plainPhone = record.Value.replace(/[^\d]/g, '');
      }
    });

    // Get cognito token
    const logins = {};
    logins[process.env.COGNITO_DEVELOPER_PROVIDER] = 'tel:' + plainPhone;
    console.log('Identity logins:', logins);
    return cognitoIdentity.getOpenIdTokenForDeveloperIdentityAsync({
      IdentityPoolId: process.env.COGNITO_POOL_ID,
      IdentityId: principalId,
      Logins: logins,
    });
  })
  .then(response => {

    // Get credentials using the token
    return cognitoIdentity.getCredentialsForIdentityAsync({
      IdentityId: principalId,
      Logins: {
        'cognito-identity.amazonaws.com': response.Token,
      },
    });
  })
  .then(response => {
    response.IotEndpoint = process.env.IOT_ENDPOINT;
    response.ThingName = principalId.replace(/:/g, '-');
    return response;
  });
}

module.exports.respond = function (event, callback) {
  getMqttCredentials('' + event.principalId)
  .then(response => {
    callback(null, response);
  })
  .catch(err => {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
