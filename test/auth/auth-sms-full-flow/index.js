'use strict';

const bus = require('../../../lib/service-bus/index');
const expect = require('chai').expect;

const Database = require('../../../lib/models/Database');
const models = require('../../../lib/models');
const Profile = require('../../../lib/business-objects/Profile');
const Transaction = require('../../../lib/business-objects/Transaction');

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
      const sortByDateDesc = (a, b) => new Date(b[TWILIO_DATE_SENT_FIELD]).getTime() -
                                       new Date(a[TWILIO_DATE_SENT_FIELD]).getTime();

      const sortedMessages = response.sort(sortByDateDesc);
      return sortedMessages[0];
    }
    return null;
  });
}

function _extractAuthCodeFromSms(sms) {
  const CODE_RE = /(\d+)/;
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
    this.timeout(40000);
    const PHONE = '+3584573975566';
    const IDENTITY_ID = 'eu-west-1:d01e10fe-ba9c-4ff6-94a1-02eee7df7516';

    let error;
    let response1;
    let response2;

    after(() => {
      // Make sure that the profile is removed from ther database
      // to avoid conflicts with future runs of this test
      return Database.init()
        .then(() => {
          return models.Profile
            .query()
            .delete()
            .where({ identityId: IDENTITY_ID });
        })
        .catch(() => null)
        .then(() => Database.cleanup());
    });

    before(() => {
      const event = {
        phone: PHONE,
      };

      return Database.init()
        // [LOGIN 1] Request a login code via SMS
        .then(() => bus.call(AUTH_REQUEST_CODE_LAMBDA, event))
        .then(() => _fetchAuthCodeSmsMessage(PHONE))
        .then(sms => {
          // Extract the login code from the SMS
          const authCode = _extractAuthCodeFromSms(sms);
          if (!authCode) {
            throw new Error('Could not retieve auth code from sms provider');
          }

          // Log in with the code
          const event = {
            phone: PHONE,
            code: authCode,
          };
          return bus.call(AUTH_LOGIN_LAMBDA, event);
        })
        .then(data => {
          response1 = data;

          // [LOGIN 2] Request a login code via SMS
          return bus.call(AUTH_REQUEST_CODE_LAMBDA, event);
        })
        .then(() => _fetchAuthCodeSmsMessage(PHONE))
        .then(sms => {
          // Extract the login code from the SMS
          const authCode = _extractAuthCodeFromSms(sms);
          if (!authCode) {
            throw new Error('Could not retieve auth code from sms provider');
          }

          // Log in with the code
          const event = {
            phone: PHONE,
            code: authCode,
          };
          return bus.call(AUTH_LOGIN_LAMBDA, event);
        })
        .then(data => {
          response2 = data;

          return data;
        })
        .then(data => {
          const transaction = new Transaction(data.cognito_id);

          // Delete this profile so that it's a "clean slate" for next time the test is run
          return transaction.start()
            .then(() => Profile.delete(data.cognito_id, transaction))
            .then(() => transaction.commit());
        })
        .then(() => {
          return Database.cleanup();
        })
        .catch(err => {
          error = err;
          return Database.cleanup();
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
      // [LOGIN 1]
      expect(response1).to.have.property('id_token');
      expect(response1).to.have.property('cognito_token');
      expect(response1).to.have.property('zendesk_token');
      expect(response1.id_token).to.not.be.empty;

      // [LOGIN 2]
      expect(response2).to.have.property('id_token');
      expect(response2).to.have.property('cognito_token');
      expect(response2).to.have.property('zendesk_token');
      expect(response2.id_token).to.not.be.empty;
    });
  });
};
