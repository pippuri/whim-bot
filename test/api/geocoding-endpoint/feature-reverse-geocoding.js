'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const validator = require('../../../lib/validator');
const event = require('../../../geocoding/reverse-geocoding-query/event.json');

module.exports = function (lambda) {

  describe('basic query', () => {

    let error;
    let response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should succeed without errors', () => {
      expect(error).to.be.null;
    });

    xit('should trigger a valid response', () => {
      return validator.validate('maas-backend:geocoding-reverse-response', response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });
  });
};
