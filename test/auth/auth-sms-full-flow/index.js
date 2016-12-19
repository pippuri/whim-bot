'use strict';

const bus = require('../../../lib/service-bus/index');
const expect = require('chai').expect;
const utils = require('../../../lib/utils');

const AUTH_REQUEST_CODE_LAMBDA = 'MaaS-auth-sms-request-code';
const AUTH_LOGIN_LAMBDA = 'MaaS-auth-sms-login';

const TWILIO_DATE_SENT_FIELD = 'date_sent';


function _fetchAuthCodeSmsMessage(phone, provider) {
  if (!provider || provider === 'undefined') {
    provider = 'twilio';
  }

  console.info('Fetching SMS messages sent to', phone);
  const functionName = 'MaaS-provider-' + provider + '-fetch-sms-messages';
  return bus.call(functionName, {
    to: phone,
  })
  .then(response => {
    // Just get the most recent one.
    // There is a potential problem if two or more people are running the tests
    // simultaneously and happen to be either side of the 30 second time window
    // in which the auth code is valid
    if (response && response.length > 0) {
      const sortDesc = (a, b) => new Date(b[TWILIO_DATE_SENT_FIELD]).getTime() - new Date(a[TWILIO_DATE_SENT_FIELD]).getTime();
      const sortedMessages = response.sort(sortDesc);
      return sortedMessages[0];
    }
    return null;
  });
}

function _extractAuthCodeFromSms(sms) {
  const CODE_RE = /\s(\d+)/;
  /*
     Your Whim code is 0292122. You can also tap the link below. Start Whimming! https://test.maas.global/login?phone=358469389773&code=0292122
  */
  if (!sms) {
    return null;
  }

  const matches = sms.body.match(CODE_RE);
  if (matches && matches.length > 0) {
    return matches[1];
  }
  return null;
}


module.exports = function () {

  describe('auth-sms-full-flow', function () { //eslint-disable-line
    this.timeout(10000);
    const PHONE = '358469389773';

    let error;
    let response;

    before(done => {
      const event = {
        phone: PHONE,
      };

      bus.call(AUTH_REQUEST_CODE_LAMBDA, event)
        .then(data => {
          return _fetchAuthCodeSmsMessage(PHONE);
        })
      .then(sms => {
        const authCode = _extractAuthCodeFromSms(sms);
        if (!authCode) {
          throw new Error('Could not retieve auth code from sms provider');
        }
        const event = {
          phone: PHONE,
          code: authCode,
        };
        return bus.call(AUTH_LOGIN_LAMBDA, event);
      })
      .then(data => {
        response = data;
        done();
      })
      .catch(err => {
        error = err;
        done();
      });
    });

    it('should not raise an error', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(error.stack);
      }

      expect(error).to.be.undefined;
    });

    it('should not return empty', () => {
      expect(response).to.have.property('id_token');
      expect(response).to.have.property('cognito_token');
      expect(response).to.have.property('zendesk_token');
      expect(response.id_token).to.not.be.empty;
    });

  });
};
