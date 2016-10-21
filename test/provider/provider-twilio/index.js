'use strict';

const testSendSMS = require('./feature-send-sms.js');

describe('Twilio (SMS) provider', () => {
  // Skip the SMS sending in normal cases
  describe.skip('Send SMS', () => {
    const lambda = require('../../../provider-twilio/provider-twilio-send-sms/handler.js');
    testSendSMS(lambda);
  });
});
