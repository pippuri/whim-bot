var AWS = require('aws-sdk');
var Promise = require('bluebird');

var cognitoIdentity = new AWS.CognitoIdentity({ region: process.env.AWS_REGION });

Promise.promisifyAll(cognitoIdentity);

/**
 * Check phoneNumber validity
 * TODO check for phoneNumber format
 */
function checkPhoneNumber(phoneNumber) {
  return true;
}

/**
 * Get/Create Cognito IdentityId
 */
function getCognitoDeveloperIdentity(phoneNumber) {
  var logins = {};
  logins[process.env.COGNITO_DEVELOPER_PROVIDER] = 'tel:' + phoneNumber;
  var options = {
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    Logins: logins,
  };

  console.log('Getting cognito developer identity with', JSON.stringify(options, null, 2));

  return cognitoIdentity.getOpenIdTokenForDeveloperIdentityAsync(options)
    .then((response) => {
      return {
        identityId: response.IdentityId,
        cognitoToken: response.Token,
      };
    });
}

module.exports.checkPhoneNumber = checkPhoneNumber;
module.exports.getCognitoDeveloperIdentity = getCognitoDeveloperIdentity;
