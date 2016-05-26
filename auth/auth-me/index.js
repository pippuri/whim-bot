var Promise = require('bluebird');
var AWS = require('aws-sdk');

var cognitoSync = new AWS.CognitoSync({ region: process.env.AWS_REGION });
Promise.promisifyAll(cognitoSync);

function getMe(identityId) {
  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: identityId,
    DatasetName: process.env.COGNITO_PROFILE_DATASET,
  })
  .then(function (response) {
    var user = {
      identityId: identityId,
    };
    response.Records.map(function (record) {
      user[record.Key] = record.Value;
    });

    return user;
  });
}

module.exports.respond = function (event, callback) {
  getMe('' + event.identityId)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
