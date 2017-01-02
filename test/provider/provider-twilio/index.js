'use strict';

const testSendSMS = require('./feature-send-sms.js');
const testFetchSMS = require('./feature-fetch-sms-messages.js');

describe('Twilio (SMS) provider', () => {
  // Skip the SMS sending in normal cases
  describe.skip('Send SMS', () => {
    const lambda = require('../../../provider-twilio/provider-twilio-send-sms/handler.js');
    testSendSMS(lambda);
  });

  describe('Fetch SMS messages', () => {
    const lambda = require('../../../provider-twilio/provider-twilio-fetch-sms-messages/handler.js');
    testFetchSMS(lambda);
  });
});
