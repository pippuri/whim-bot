'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;

module.exports = function (lambda) {

  describe('for a nonexistent user', () => {

    // Generate 8 random hex characters
    const randomHex = Math.random().toString(16).replace('.', '').substr(0, 8);
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

    it('should not raise an error', () => {
      expect(error).to.be.null;
    });

    it('should return empty', () => {
      expect(response).to.deep.equal({});
    });

  });
};
