'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const validator = require('../../../lib/validator/index');

module.exports = function (lambda) {

  describe('query for an existing user', () => {

    const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';
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

    it('should not raise an error', () => {
      expect(error).to.be.null;
    });

    it('should return a valid response', () => {

      return validator.validate('maas-backend:profile-info-response', response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });

    });

  });
};
