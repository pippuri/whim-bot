'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;

module.exports = function (lambda) {

  describe('for an existing user', () => {

    const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

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

    it('should raise an error', () => {
      const errorMessage = '' + error;
      expect(errorMessage).to.contain('User Existed');
    });

    it('should not return a response', () => {
      expect(response).to.be.undefined;
    });

  });
};
