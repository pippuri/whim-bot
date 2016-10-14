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
  .catch(err => {
    const response = JSON.parse(err.response.toString());
    if (err.statusCode === 400) {
      callback(new MaaSError(response.message, 400));
    }

    console.warn(err);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(new MaaSError(`Internal server error: ${response.message}`, 500));
  });
};
