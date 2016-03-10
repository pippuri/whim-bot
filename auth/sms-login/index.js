var Promise = require('bluebird');
var AWS = require('aws-sdk');

/**
 * Perform an OAuth2 login using a verification code (or link) sent by SMS.
 */
function smsLogin(phoneNumber, verificationCode) {
  return Promise.resolve({
  });
}

module.exports.respond = function (event, callback) {
  smsLogin(event.phoneNumber, event.verificationCode)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
