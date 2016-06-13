'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;

module.exports = (lambda) => {

  describe('for a nonexistent user', function () {

    const randomHex = ('0000' + (Math.random() * 0xffff).toString(16)).slice(-4);
    const identityId = 'eu-west-1:00000000-dead-' + randomHex + '-dead-000000000000';

    const event = {
      identityId: identityId,
      payload: {
        phone: Math.random() * 1000,
      },
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

    it('should not raise an error', function () {
      expect(error).to.be.null;
    });

    it('should return empty', function () {
      expect(response).to.deep.equal({});
    });

  });
};
