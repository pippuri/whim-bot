'use strict';

const request = require('request-promise-lite');
const MaaSError = require('../../lib/errors/MaaSError');

const TWILIO_API_URL = 'https://api.twilio.com/2010-04-01';

/**
 * Handle an imcoming SMS message received at Twilio.
 */
function sendSmsMessage(phone, message) {
  //console.info('Sending SMS message:', phone, message);
  return request.post(TWILIO_API_URL + '/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages.json', {
    form: {
      From: 'Whim',
      To: phone,
      Body: message,
    },
    auth: {
      user: process.env.TWILIO_ACCOUNT_SID,
      pass: process.env.TWILIO_ACCOUNT_TOKEN,
      sendImmediately: true,
    },
  })
  .then(response => {
    return {
      response: response,
    };
  });
}

module.exports.respond = (event, callback) => {
  sendSmsMessage(event.phone, event.message)
  .then(response => callback(null, response.toString()))
  .catch(_error => {
    console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    if (_error.statusCode === 400) {
      callback(new MaaSError(JSON.parse(_error.response.toString()).message, 400));
    }

    // Uncaught, unexpected error
    if (_error instanceof MaaSError) {
      callback(_error);
      return;
    }

    callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
  });
};
