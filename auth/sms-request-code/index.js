var Promise = require('bluebird');
var AWS = require('aws-sdk');
var lambda = new AWS.Lambda({region:process.env.AWS_REGION});
Promise.promisifyAll(lambda, {suffix:'Promise'});

/**
 * Request a login verification code by SMS.
 */
function smsRequestCode(phone, provider) {
  if (!provider) {
    provider = 'twilio';
  }
  var verificationCode = 1000 + Math.floor(Math.random() * 9000);
  var functionName = 'MaaS-provider-' + provider + '-send-sms';
  return lambda.invokePromise({
    FunctionName: functionName,
    Qualifier: process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev'),
    ClientContext: new Buffer(JSON.stringify({})).toString('base64'),
    Payload: JSON.stringify({
      phone: phone,
      message: 'Your login verification code is ' + verificationCode + '.'
    })
  })
  .then(function (response) {
    return Promise.resolve({
      message: 'Verification code sent to ' + phone,
      response: JSON.parse(response.Payload)
    });
  });
}

module.exports.respond = function (event, callback) {
  smsRequestCode(event.phone, event.provider)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
