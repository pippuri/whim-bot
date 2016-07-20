'use strict';

const testSendSMS = require('./feature-send-sms.js');

describe('Twilio (SMS) provider', () => {
  const _this = this;

  // Skip the SMS sending in normal cases
  describe.skip('Send SMS', () => {
    _this.timeout = 20000;
    const lambda = require('../../../provider-twilio/provider-twilio-send-sms/handler.js');
    testSendSMS(lambda);
  });
});
