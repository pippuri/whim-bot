'use strict';

const request = require('request-promise-lite');
const MaaSError = require('../../lib/errors/MaaSError');

const TWILIO_API_URL = 'https://api.twilio.com/2010-04-01';
const NON_ALPHA_CODES = ['+90']; // list of country codes that don't support alpha
const DEFAULT_FROM = 'Whim';

/**
 * Handle an imcoming SMS message received at Twilio.
 */
function sendSmsMessage(phone, message) {
  let fromField = DEFAULT_FROM;

  // This only works with two-digit country codes and may fail with some three-digit ones
  // but a quick fix for Turkey, basically
  NON_ALPHA_CODES.forEach( code => {
    if (code === phone.substr(0, code.length)) {
      fromField = `+${process.env.TWILIO_FROM_NUMBER}`;
    }
  });
  //console.info('Sending SMS message:', phone, message, 'From Field being:', fromField);

  return request.post(TWILIO_API_URL + '/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages.json', {
    form: {
      From: fromField,
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
    console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
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
