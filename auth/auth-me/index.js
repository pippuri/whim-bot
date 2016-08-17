'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');

const cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });
Promise.promisifyAll(cognitoSync);

function getMe(principalId) {
  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: principalId,
    DatasetName: process.env.COGNITO_PROFILE_DATASET,
  })
  .then(response => {
    const user = {
      principalId: principalId,
    };
    response.Records.map(record => {
      user[record.Key] = record.Value;
    });

    return user;
  });
}

module.exports.respond = function (event, callback) {
  getMe('' + event.principalId)
  .then(response => {
    callback(null, response);
  })
  .catch(err => {
    console.info('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
