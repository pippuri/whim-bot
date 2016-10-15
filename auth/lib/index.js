'use strict';

/**
 * Helper functions for authorization, etc.
 */
const crypto = require('crypto');

const AUTH_TOPT_TOKEN_TTL_SECS = 300;
const AUTH_TOPT_TOKEN_LENGTH = 7;
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

/**
 * Generate a TOPT authentication code based on the given secret Buffer or string
 * @param {Buffer} secret - The secret to use, can also be a string
 * @param {number} adjustment - An increment on the time window used, e.g. -1 means the previous code
 * @param {number} timeOverride - Use the given timestamp as the basis for the code
 * @param {number} ttl - How long the code should last, in seconds, this is more like an approximate time window
 *
 * See: https://en.wikipedia.org/wiki/Google_Authenticator
*/
/* eslint-disable no-bitwise */
function __generate_topt_login_code_exec(secret, adjustment, timeOverride, ttl) {
  // The key is specific to the given phone number
  const key = secret;

  // Convert ms -> secs
  const unix_time = timeOverride / 1000;

  // message := floor(current Unix time / 30)
  const message = new Buffer(8);
  message.fill(0);
  message.writeInt32BE(Math.floor(unix_time / ttl) + adjustment, 4);

  // hash := HMAC-SHA1(key, message)
  const hash = crypto.createHmac('sha1', key)
                     .update(message)
                     .digest();

  // offset := last nibble of hash
  const offset = hash[hash.length - 1] & 0x0F;

  // truncatedHash := hash[offset..offset+3]  //4 bytes starting at the offset
  const truncatedHash = hash.slice(offset, offset + 4);

  // Set the first bit of truncatedHash to zero
  truncatedHash[0] = truncatedHash[0] & 0x7F;

  // code := truncatedHash mod 1000000
  let code = (truncatedHash.readInt32BE() % 1000000) + '';

  // pad code with 0 until length of code is AUTH_TOPT_TOKEN_LENGTH
  if (code.length < AUTH_TOPT_TOKEN_LENGTH) {
    code = '0'.repeat(AUTH_TOPT_TOKEN_LENGTH).slice(0, AUTH_TOPT_TOKEN_LENGTH - code.length) + code;
  }

  return code;
}
/* eslint-enable no-bitwise */

/**
 * Generate a TOPT authentication code based on the given phone string.
 * @param {string} plainPhone - The phone number without any spaces or punctuation
 * @param {number} adjustment - An increment on the time window used, e.g. -1 means the previous code
 * @param {number} timeOverride - Optionally use the given timestamp as the basis for the code, used for testing
*/
function generate_topt_login_code(plainPhone, adjustment, timeOverride) {
  // Defaults for optional params
  if (typeof adjustment === typeof undefined) {
    adjustment = 0;
  }
  if (typeof timeOverride === typeof undefined) {
    timeOverride = Date.now();
  }

  return __generate_topt_login_code_exec(
                  process.env.SMS_CODE_SECRET + plainPhone,
                  adjustment,
                  timeOverride,
                  AUTH_TOPT_TOKEN_TTL_SECS);
}


function verify_topt_login_code(isSimulationUser, plainPhone, code) {
  if (isSimulationUser) {
    // Simulation users accept login with code 292
    console.info('User is a simulation user');
    return (code === AUTH_DEFAULT_LOGIN_CODE);

  }

  // FIXME test account code (given to Apple)
  if (plainPhone === '358417556933' && code === '2503870') {
    return true;
  }

  // Generate the current code, and also the one before and after
  const codes = [
    generate_topt_login_code(plainPhone, -1),
    generate_topt_login_code(plainPhone, 0),
    generate_topt_login_code(plainPhone, 1),
  ];

  return (codes.indexOf(code) !== -1);
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

  return (code === generate_login_code(plainPhone));
}


module.exports = {
  AUTH_DEFAULT_LOGIN_CODE: AUTH_DEFAULT_LOGIN_CODE,
  __generate_topt_login_code_exec: __generate_topt_login_code_exec,
  generate_sms_message: generate_sms_message,
  generate_topt_login_code: generate_topt_login_code,
  verify_topt_login_code: verify_topt_login_code,
  generate_login_code: generate_login_code,
  generate_login_link: generate_login_link,
  verify_login_code: verify_login_code,
};
