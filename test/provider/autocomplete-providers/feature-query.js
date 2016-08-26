'use strict';

const chai = require('chai');
const expect = chai.expect;
const wrap = require('lambda-wrapper').wrap;

const validator = require('../../../lib/validator');

module.exports = function (lambda) {

  describe('autocomplete request', () => {

    const event = {
      hint: 'latlon',
      name: 'Kamp',
      count: 5,
      country: 'FI',
      lat: 60.1675800,
      lon: 24.9302260,
      radius: 5,
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

    it('should be successful', () => {
      expect(error).to.be.null;
    });

    xit('should trigger a valid response', () => {
      validator.validate('maas-backend:autocomplete-query-response', response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });
  });
};
