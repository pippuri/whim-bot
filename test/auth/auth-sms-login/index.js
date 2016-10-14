'use strict';

const bus = require('../../../lib/service-bus/index');
const lib = require('../../../auth/lib/index');
const expect = require('chai').expect;

const LAMBDA = 'MaaS-auth-sms-login';


module.exports = function () {

  describe.skip('auth-sms-login', function () { //eslint-disable-line
    this.timeout(10000);
    const PHONE = '+358417556933';
    const PLAIN_PHONE = '358417556933';

    let error;
    let response;

    before(done => {

      const event = {
        phone: PHONE,
        code: lib.generate_topt_login_code(PLAIN_PHONE),
      };

      bus.call(LAMBDA, event)
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

  describe('auth-sms-login failure', function () { //eslint-disable-line
    this.timeout(10000);
    const PHONE = '+358417556933';
    const BAD_CODE = '666';

    let error;
    let response;

    before(done => {
      const event = {
        phone: PHONE,
        code: BAD_CODE,
      };

      bus.call(LAMBDA, event)
        .then(data => {
          response = data;
          done();
        })
        .catch(err => {
          error = err;
          done();
        });
    });

    it('should raise an error', () => {
      expect(error).to.not.be.undefined;
      expect(response).to.be.undefined;
    });

    it('should not return empty', () => {
      expect(error).to.have.property('message');
      expect(error.message).to.not.contain('500');
      expect(error.message).to.contain('401');
    });
  });

};
