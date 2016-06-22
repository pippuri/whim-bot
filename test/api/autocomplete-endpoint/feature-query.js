'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const validator = require('../../../lib/validator');
const schema = require('../../../autocomplete/autocomplete-query/response-schema.json');
const event = require('../../../autocomplete/autocomplete-query/event.json');

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

    it('should trigger a valid response', () => {
      return validator.validate(response, schema)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });
  });
};
