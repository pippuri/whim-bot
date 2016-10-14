'use strict';

const request = require('request-promise-lite');

const TWILIO_API_URL = 'https://api.twilio.com/2010-04-01';

/**
 * Handle an imcoming SMS message received at Twilio.
 */
function sendSmsMessage(phone, message) {
  //console.info('Sending SMS message:', phone, message);
  return request.post(TWILIO_API_URL + '/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages', {
    form: {
      From: process.env.TWILIO_FROM_FIELD,
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
    console.info(err.response.toString());
    console.info('This event caused error: ' + JSON.stringify(event, null, 2));
  });
};
