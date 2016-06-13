'use strict';

const chai = require('chai');
const expect = chai.expect;
const wrap = require('lambda-wrapper').wrap;

const validator = require('../../lib/validator');
const schema = require('../../autocomplete/autocomplete-query/response-schema.json');

module.exports = (lambda) => {

  describe('autocomplete request', function () {

    const event = {
      hint: 'latlon',
      name: 'Kamp',
      count: 5,
      country: 'FI',
      lat: 60.1675800,
      lon: 24.9302260,
      radius: 5,
    };

    var error;
    var response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        response = data;
        done();
      });
    });

    it('should be successful', function () {
      expect(error).to.be.null;
    });

    it('should trigger a valid response', function () {
      validator.validate(response, schema)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });
  });
};
