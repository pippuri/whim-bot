'use strict';


const AWS = require('aws-sdk');
const bus = require('../../lib/service-bus');
const errors = require('../../lib/errors');
const lib = require('../lib');

AWS.config.update({ region: 'eu-west-1' });
const s3 = new AWS.S3();

function loadGreenlist() {
  let stage;
  switch (process.env.SERVERLESS_STAGE) {
    case 'alpha':
    case 'prod':
      stage = 'prod';
      break;
    case 'dev':
    case 'test':
    default:
      stage = 'dev';
      break;
  }

  return s3.getObject({
    Bucket: 'maas-serverless',
    Key: `serverless/MaaS/greenlists/greenlist-${stage}.json`,
  }).promise()
  .then(result => Promise.resolve(JSON.parse(new Buffer(result.Body).toString('ascii'))));
}

function sanitizePhoneNumber(input) {
  // Remove anything that is neither digit nor plus(+) sign
  let cleanNumber = input.replace(/[^\d]/g, '');

  // Add back the plus(+) sign to the beginning of the number
  cleanNumber = '+' + cleanNumber;

  // Validate the phone number
  if (!cleanNumber.match(/^\+(?:\d){6,14}\d$/g)) {
    throw new errors.MaaSError('Invalid phone number', 400);
  }

  return cleanNumber;
}

function checkGreenlist(greenlist, phone) {
  if (!greenlist) {
    console.info('Not checking against greenlist');
    return Promise.resolve();
  }

  const regexes = greenlist.filter(i => i.startsWith('/'));
  if (regexes.length > 0) {
    console.info('Checking against greenlist regexes: ', phone);
    const matches = regexes.some(re => phone.replace('+', '').match(re));
    if (matches.length > 0) {
      console.info('Matched against greenlist regex(es): ', phone, matches);
      return Promise.resolve();
    }
  }

  console.info('Checking against greenlist for phone number: ', phone);
  if (greenlist.indexOf(phone.replace('+', '')) === -1) {
    return Promise.reject(new errors.MaaSError('Unauthorized', 401));
  }

  return Promise.resolve();
}

/**
 * Request a login verification code by SMS.
 */
function smsRequestCode(phone, provider) {
  if (!provider || provider === 'undefined') {
    provider = 'twilio';
  }

  const verificationCode = lib.generate_topt_login_code(phone);
  const verificationLink = lib.generate_login_link(phone, verificationCode);

  console.info('Sending SMS verification code', verificationCode, 'to', phone, 'with link', verificationLink, 'plainphone', phone);

  return bus.call(`MaaS-provider-${provider}-send-sms`, {
    phone: phone,
    message: lib.generate_sms_message(verificationCode, verificationLink),
  })
  .then(response => {
    return {
      message: 'Verification code sent to ' + phone,
      response: response.Payload,
    };
  });
}

module.exports.respond = function (event, callback) {
  let sanitizedNumber;

  return Promise.resolve()
    .then(() => {
      sanitizedNumber = sanitizePhoneNumber(event.phone);
      return loadGreenlist();
    })
    .then(greenlist => checkGreenlist(greenlist, sanitizedNumber.replace(/[^\d]/g, '')))
    .then(() => smsRequestCode(sanitizedNumber, event.provider))
    .then(response => {
      callback(null, response);
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof errors.MaaSError) {
        callback(_error);
        return;
      }

      callback(new errors.MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
