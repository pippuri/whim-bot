'use strict';

const expect = require('chai').expect;
const utils = require('../../../lib/utils');
const validator = require('../../../lib/validator');
const wrap = require('lambda-wrapper').wrap;

const schema = require('maas-schemas/prebuilt/maas-backend/geocoding/geocoding-reverse/response.json');

module.exports = (lambda, fixture) => {
  describe('basic tests of a simple query', () => {
    const event = {
      name: 'Kamppi Bus Station',
      count: 5,
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

    it('should succeed without errors', () => {
      expect(error).to.be.null;
    });

    it('should trigger a valid response after sanitization', () => {
      return validator.validate(schema, utils.sanitize(response));
    });
  });

  fixture.forEach(item => {
    describe(['Search:', item.input.lat, item.input.lon, item.pass].join(' '), () => {
      let error;
      let response;

      before(done => {
        wrap(lambda).run(item.input, (err, data) => {
          error = err;
          response = data;
          done();
        });
      });

      it('should have a valid answer after sanitization', () => {
        if (!item.pass) {
          expect(error).to.not.be.null;
          return Promise.resolve();
        }

        expect(response.features).to.not.be.empty;
        return validator.validate(schema, utils.sanitize(response));
      });
    });
  });
};
