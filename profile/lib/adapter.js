
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var LookupsClient = require('twilio').LookupsClient;

var client = new LookupsClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_ACCOUNT_TOKEN);
var cognitoIdentity = new AWS.CognitoIdentity({ region: process.env.AWS_REGION });

Promise.promisifyAll(cognitoIdentity);

/**
 * Check phoneNumber validity
 */
function checkPhoneNumber(phoneNumber) {
  var promise = new Promise(function (resolve, reject) {
    client.phoneNumbers(phoneNumber).get(function (error, number) {
      if (error) {
        reject(new Error('Wrong number'));
      } else {
        resolve(number);
      }
    });
  });

  return promise;
}

/**
 * Get/Create Cognito IdentityId
 */
function getCognitoDeveloperIdentity(phoneNumber) {
  return checkPhoneNumber(phoneNumber)
    .then((response) => {
      var logins = {};
      logins[process.env.COGNITO_DEVELOPER_PROVIDER] = 'tel:' + phoneNumber;
      var options = {
        IdentityPoolId: process.env.COGNITO_POOL_ID,
        Logins: logins,
      };

      console.log('Getting cognito developer identity with', JSON.stringify(options, null, 2));

      return cognitoIdentity.getOpenIdTokenForDeveloperIdentityAsync(options);
    })
    .then(function (response) {
      return {
        identityId: response.IdentityId,
      };
    });
}

module.exports = {
  checkPhoneNumber: checkPhoneNumber,
  getCognitoDeveloperIdentity: getCognitoDeveloperIdentity,
};
