'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const validator = require('../../../lib/validator/index');
const schema = require('../../../bookings/bookings-retrieve/response-schema.json');
const event = require('../../../bookings/bookings-retrieve/event.json');

module.exports = function (lambda) {

  describe('retrieve an existing booking', () => {

    let response;
    let error;

    before(done => {
      wrap(lambda).run(event, (err, res) => {
        response = res;
        error = err;
        done();
      });
    });

    it('should return a valid response', () => {
      // FIXME change this when bookings are returning in correct states
      response.state = 'RESERVED';
      return validator.validate(response, schema)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('should succeed without error', () => {
      expect(error).to.be.null;
    });
  });
};
