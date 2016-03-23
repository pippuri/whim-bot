var Promise = require('bluebird');
var AWS = require('aws-sdk');

var cognito = new AWS.CognitoIdentity();

function getMqttCredentials(principalId) {
  return cognito.getCredentialsForIdentityAsync({
    IdentityId: auth.user.identityId
  });
}

module.exports.respond = function (event, callback) {
  getMqttCredentials(''+event.principalId)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
