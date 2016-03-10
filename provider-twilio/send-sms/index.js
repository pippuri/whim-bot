var Promise = require('bluebird');
var requiest = require('request-promise');

/**
 * Handle an imcoming SMS message received at Twilio.
 */
function sendSmsMessage(phone, message) {
  console.log('Sending SMS message:', phone, message);
  return Promise.resolve({
  });
}

module.exports.respond = function (event, callback) {
  sendSmsMessage(event.phone, event.message)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
