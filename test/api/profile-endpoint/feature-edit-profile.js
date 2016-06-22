'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const validator = require('../../../lib/validator');
const schema = require('../../../profile/profile-edit/response-schema.json');
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
        console.warn(error.message);
        console.warn(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should return a valid response', () => {
      return validator.validate(response, schema)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });
  });
};
