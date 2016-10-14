'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const schema = require('maas-schemas/prebuilt/maas-backend/profile/profile-edit/response.json');
const validator = require('../../../lib/validator');
const event = require('../../../profile/profile-edit/event.json');

module.exports = function (lambda) {

  describe('edit an existing user', () => {
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
      if (error) {
        console.warn('Caught an error:', error.message);
        console.warn(error.stack);
      }

      expect(error).to.not.exist;
    });

    xit('should return a valid response', () => {
      return validator.validate(schema, response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });
  });
};
