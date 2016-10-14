'use strict';

/**
 * Helper functions for authorization, etc.
 */
const crypto = require('crypto');

const AUTH_DEFAULT_LOGIN_CODE = '292';


function generate_login_link(phone, code) {
  return process.env.WWW_BASE_URL +
         '/login?phone=' +
         encodeURIComponent(phone) +
         '&code=' +
         encodeURIComponent(code);
}

function generate_sms_message(verificationCode, verificationLink) {
  return 'Your Whim code is ' +
         verificationCode +
         '. You can also tap the link below. Start Whimming! ' +
         verificationLink;
}

function generate_login_code(plainPhone) {
  const shasum = crypto.createHash('sha1');
  const salt = '' + (100 + Math.floor(Math.random() * 900));
  shasum.update(salt + process.env.SMS_CODE_SECRET + plainPhone);
  const hash = shasum.digest('hex');
  const verificationCode = salt + '' + (100 + parseInt(hash.slice(0, 3), 16));

  return verificationCode;
}

function verify_login_code(isSimulationUser, plainPhone, code) {
  if (isSimulationUser) {
    // Simulation users accept login with code 292
    console.info('User is a simulation user');
    return (code === AUTH_DEFAULT_LOGIN_CODE);

  }

  // Real users must have a real code received via SMS
  const shasum = crypto.createHash('sha1');
  const salt = code.slice(0, 3);
  shasum.update(salt + process.env.SMS_CODE_SECRET + plainPhone);
  const hash = shasum.digest('hex');
  const correctCode = salt + '' + (100 + parseInt(hash.slice(0, 3), 16));

  return (code === correctCode);
}


module.exports = {
  AUTH_DEFAULT_LOGIN_CODE: AUTH_DEFAULT_LOGIN_CODE,
  generate_sms_message: generate_sms_message,
  generate_login_code: generate_login_code,
  generate_login_link: generate_login_link,
  verify_login_code: verify_login_code,
};
