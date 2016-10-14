'use strict';

const Promise = require('bluebird');
const crypto = require('crypto');
const AWS = require('aws-sdk');
const MaaSError = require('../../lib/errors/MaaSError');

const lambda = new AWS.Lambda({ region: process.env.AWS_REGION });
Promise.promisifyAll(lambda, { suffix: 'Promise' });

/**
 * Request a login verification code by SMS.
 */
function smsRequestCode(phone, provider) {
  if (!provider || provider === 'undefined') {
    provider = 'twilio';
  }

  // Clean up phone number to only contain digits
  const plainPhone = phone.replace(/[^\d]/g, '');
  if (!plainPhone || plainPhone.length < 4) {
    return Promise.reject(new Error('Invalid phone number'));
  }

  const shasum = crypto.createHash('sha1');
  const salt = '' + (100 + Math.floor(Math.random() * 900));
  shasum.update(salt + process.env.SMS_CODE_SECRET + plainPhone);
  const hash = shasum.digest('hex');
  const verificationCode = salt + '' + (100 + parseInt(hash.slice(0, 3), 16));
  const verificationLink = process.env.WWW_BASE_URL + '/login?phone=' + encodeURIComponent(phone) + '&code=' + encodeURIComponent(verificationCode);
  const functionName = 'MaaS-provider-' + provider + '-send-sms';
  console.info('Sending SMS verification code', verificationCode, 'to', phone, 'with link', verificationLink, 'plainphone', plainPhone);
  return lambda.invokePromise({
    FunctionName: functionName,
    Qualifier: process.env.SERVERLESS_STAGE.replace(/^local$/, 'dev'),
    ClientContext: new Buffer(JSON.stringify({})).toString('base64'),
    Payload: JSON.stringify({
      phone: phone,
      message: 'Your MaaS login verification code is ' + verificationCode + '. Direct link: ' + verificationLink,
    }),
  })
  .then(response => {
    return Promise.resolve({
      message: 'Verification code sent to ' + phone,
      response: JSON.parse(response.Payload),
    });
  });
}

module.exports.respond = function (event, callback) {
  return Promise.resolve()
    .then(() => smsRequestCode(`${event.phone}`, `${event.provider}`))
    .then(response => {
      callback(null, response);
    })
  .catch(_error => {
    console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    if (_error instanceof MaaSError) {
      callback(_error);
      return;
    }

    callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
  });
};
