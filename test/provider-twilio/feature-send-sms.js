'use strict';

const chai = require('chai');
const expect = chai.expect;
const wrap = require('lambda-wrapper').wrap;
const event = require('../../provider-twilio/provider-twilio-send-sms/event.json');

module.exports = (lambda) => {

  describe('send-sms request', () => {
    let error;
    let response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should be successful', () => {
      expect(error).to.be.null;
    });
  });
};
