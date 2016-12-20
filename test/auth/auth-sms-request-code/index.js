'use strict';

const bus = require('../../../lib/service-bus/index');
const expect = require('chai').expect;

const LAMBDA = 'MaaS-auth-sms-request-code';


module.exports = function () {

  describe('auth-sms-request-code', function () { //eslint-disable-line
    this.timeout(10000);
    const PHONE = '3584573975566';

    let error;
    let response;

    before(done => {
      const event = {
        phone: PHONE,
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
      expect(response).to.have.property('message');
      expect(response.message).to.contain('Verification code sent');
      expect(response.message).to.contain(PHONE);
    });
  });

  describe('auth-sms-request-code short number failure', () => {
    const BAD_PHONE = '+292';

    let error;
    let response;

    before(done => {
      const event = {
        phone: BAD_PHONE,
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
      expect(error.message).to.contain('Invalid phone number');
    });
  });

  describe('auth-sms-request-code bad failure', () => {
    const BAD_PHONE = '+292123456789';

    let error;
    let response;

    before(done => {
      const event = {
        phone: BAD_PHONE,
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
      expect(error.message).to.contain('400');
      expect(error.message).to.not.contain('500');
    });
  });

  describe('auth-sms-request-code non-greenlisted number fails', () => {
    const PHONE = '+358465727141';

    let error;
    let response;

    before(done => {
      const event = {
        phone: PHONE,
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
