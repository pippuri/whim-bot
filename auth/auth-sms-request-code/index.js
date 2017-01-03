'use strict';

const Promise = require('bluebird');
const bus = require('../../lib/service-bus');
const errors = require('../../lib/errors');
const lib = require('../lib');
const AWS = require('aws-sdk');

AWS.config.update({ region: 'eu-west-1' });
const S3 = Promise.promisifyAll(new AWS.S3());

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
  return S3.getObjectAsync({
    Bucket: 'maas-serverless',
    Key: `serverless/MaaS/greenlist/greenlist-${stage}.json`,
  })
  .then(result => Promise.resolve(JSON.parse(new Buffer(result.Body).toString('ascii'))));
}

function cleanPhoneNumber(input) {
  const cleanNumber = input.replace(/[^\d]/g, '');
  if (!cleanNumber || cleanNumber.length < 4) {
    throw new errors.MaaSError('Invalid phone number', 400);
  }
  return cleanNumber;
}

function checkGreenlist(greenlist, phone) {
  if (!greenlist) {
    console.info('Not checking against greenlist');
    return Promise.resolve();
  }

  console.info('Checking against greenlist for phone number: ', phone);
  if (greenlist.indexOf(phone) === -1) {
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
  return loadGreenlist()
    .then(greenlist => checkGreenlist(greenlist, cleanPhoneNumber(event.phone)))
    .then(response => smsRequestCode(cleanPhoneNumber(event.phone), event.provider))
    .then(response => {
      callback(null, response);
    })
    .catch(errors.stdErrorHandler(callback, event));
};
