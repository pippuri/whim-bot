const testSendSMS = require('./feature-send-sms.js');
const testReceiveSMS = require('./feature-receive-sms.js');

describe('Twilio (SMS) provider', () => {

  describe('Send SMS', () => {
    this.timeout(20000);
    var lambda = require('../../provider-twilio/provider-twilio-send-sms/handler.js');
    testSendSMS(lambda);
  });
});
