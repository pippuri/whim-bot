'use strict';

const Promise = require('bluebird');
const bus = require('../../lib/service-bus/index');
const errors = require('../../lib/errors/index');
const lib = require('../lib/index');
const AWS = require('aws-sdk');
AWS.config.update({ region: 'eu-west-1' });
const S3 = Promise.promisifyAll(new AWS.S3());

function loadGreenlist() {
  let stage;
  switch (process.env.SERVERLESS_STAGE) {
    case 'alpha':
    case 'prod':
      stage = 'dev';
      break;
    case 'dev':
    case 'test':
    default:
      stage = 'prod';
      break;
  }
  return S3.getObjectAsync({
    Bucket: 'maas-serverless',
    Key: `serverless/MaaS/greenlist/greenlist-${stage}.json`,
  })
  .then(result => JSON.parse(new Buffer(result.Body).toString('ascii')));
}

function checkGreenlist(greenlist, event) {
  if (!greenlist) {
    console.info('Not checking against greenlist');
    return Promise.resolve();
  }

  console.info('Checking against greenlist for phone number: ', event.phone);
  if (greenlist.indexOf(event.plainPhone) === -1) {
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

  // Clean up phone number to only contain digits
  const plainPhone = phone.replace(/[^\d]/g, '');
  if (!plainPhone || plainPhone.length < 4) {
    return Promise.reject(new errors.MaaSError('Invalid phone number', 400));
  }

  const verificationCode = lib.generate_topt_login_code(plainPhone);
  const verificationLink = lib.generate_login_link(phone, verificationCode);

  console.info('Sending SMS verification code', verificationCode, 'to', phone, 'with link', verificationLink, 'plainphone', plainPhone);
  const functionName = 'MaaS-provider-' + provider + '-send-sms';
  return bus.call(functionName, {
    phone: phone,
    message: lib.generate_sms_message(verificationCode, verificationLink),
  })
  .then(response => {
    return Promise.resolve({
      message: 'Verification code sent to ' + phone,
      response: response.Payload,
    });
  });
}

module.exports.respond = function (event, callback) {
  return loadGreenlist()
    .then(greenlist => checkGreenlist(greenlist, event))
    .then(smsRequestCode(`${event.phone}`, `${event.provider}`))
    .then(response => {
      callback(null, response);
    })
    .catch(errors.stdErrorHandler(callback, event));
};
