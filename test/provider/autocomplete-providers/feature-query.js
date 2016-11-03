'use strict';

const chai = require('chai');
const expect = chai.expect;
const wrap = require('lambda-wrapper').wrap;
const schema = require('maas-schemas/prebuilt/maas-backend/autocomplete/autocomplete-query/response.json');
const validator = require('../../../lib/validator');

module.exports = function (lambda) {

  describe('autocomplete request', () => {
    const event = {
      name: 'Kamp',
      count: 5,
      lat: 60.1675800,
      lon: 24.9302260,
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

    it('should trigger a valid response', () => {
      return validator.validate(schema, response);
    });
  });

  describe('autocomplete request with scandinavian letters', () => {
    const event = {
      name: 'Sörnä',
      lat: 60.1675800,
      lon: 24.9302260,
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

    it('should trigger a valid response', () => {
      return validator.validate(schema, response);
    });
  });
};
