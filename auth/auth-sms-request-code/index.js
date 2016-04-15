var Promise = require('bluebird');
var crypto = require('crypto');
var AWS = require('aws-sdk');
var lambda = new AWS.Lambda({ region:process.env.AWS_REGION });
Promise.promisifyAll(lambda, { suffix:'Promise' });

/**
 * Request a login verification code by SMS.
 */
function smsRequestCode(phone, provider) {
  if (!provider || provider === 'undefined') {
    provider = 'twilio';
  }

  // Clean up phone number to only contain digits
  var plainPhone = phone.replace(/[^\d]/g, '');
  if (!plainPhone || plainPhone.length < 4) {
    return Promise.reject(new Error('Invalid phone number'));
  }

  var shasum = crypto.createHash('sha1');
  var salt = '' + (100 + Math.floor(Math.random() * 900));
  shasum.update(salt + process.env.SMS_CODE_SECRET + plainPhone);
  var hash = shasum.digest('hex');
  var verificationCode = salt + '' + (100 + parseInt(hash.slice(0, 3), 16));
  var verificationLink = process.env.WWW_BASE_URL + '/login?phone=' + encodeURIComponent(phone) + '&code=' + encodeURIComponent(verificationCode);
  var functionName = 'MaaS-provider-' + provider + '-send-sms';
  console.log('Sending SMS verification code', verificationCode, 'to', phone, 'with link', verificationLink, 'plainphone', plainPhone);
  return lambda.invokePromise({
    FunctionName: functionName,
    Qualifier: process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev'),
    ClientContext: new Buffer(JSON.stringify({})).toString('base64'),
    Payload: JSON.stringify({
      phone: phone,
      message: 'Your MaaS login verification code is ' + verificationCode + '. Direct link: ' + verificationLink,
    }),
  })
  .then(function (response) {
    return Promise.resolve({
      message: 'Verification code sent to ' + phone,
      response: JSON.parse(response.Payload),
    });
  });
}

module.exports.respond = function (event, callback) {
  smsRequestCode('' + event.phone, '' + event.provider)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};