'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const schema = require('maas-schemas/prebuilt/maas-backend/autocomplete/autocomplete-query/response.json');
const validator = require('../../../lib/validator');
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
      return validator.validate(schema, response);
    });
  });

  describe('scandinavian letters', () => {
    let error;
    let response;

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        name: 'Sör',
        count: '5',
        lat: '24',
        lon: '24',
      },
    };

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
      return validator.validate(schema, response);
    });
  });

  describe('invalid input', () => {
    let error;

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      payload: {
        foo: 'bar',
      },
    };

    before(done => {
      wrap(lambda).run(event, (err, data) => {
        error = err;
        done();
      });
    });

    it('should throw an error', () => {
      expect(error).to.exist;
      expect(error.code).to.equal(400);
    });
  });
};
