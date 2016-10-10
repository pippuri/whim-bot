'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;

module.exports = function (lambda) {

  describe('query for a nonexisting user', () => {

    const randomHex = ('0000' + (Math.random() * 0xffff).toString(16)).slice(-4);
    const identityId = 'eu-west-1:00000000-dead-' + randomHex + '-dead-000000000000';
    const event = {
      identityId: identityId,
    };

    let error;
    let response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should raise an error', () => {
      expect(error.message).to.equal('403: Profile not available');
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });

  });
};
