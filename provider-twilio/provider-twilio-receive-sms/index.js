var BBPromise = require('bluebird');

/**
 * Handle an imcoming SMS message received at Twilio.
 */
function receiveSmsMessage(event) {
  console.log('Received SMS message:', event);
  return BBPromise.resolve({
    message: 'Got your message!',
  });
}

module.exports.respond = function (event, callback) {
  receiveSmsMessage(event)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
