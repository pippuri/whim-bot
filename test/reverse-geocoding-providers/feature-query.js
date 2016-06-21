'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const ajv = require('ajv')({ verbose: true });

module.exports = (lambda, schema, fixture) => {
  describe('basic tests of a simple query', () => {
    const event = {
      lat: 660.16732510000001,
      lon: 24.9306569,
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

    it('should trigger a valid response', () => {
      const valid = ajv.validate(schema, response);
      const validationError = valid ? null : JSON.stringify(ajv.errors);
      expect(validationError).to.be.null;
    });
  });

  fixture.forEach(item => {
    describe(['Search:', item.input.lat, item.input.lon, item.pass].join(','), () => {
      let error;
      let response;

      before(done => {
        wrap(lambda).run(item.input, (err, data) => {
          error = err;
          response = data;
          done();
        });
      });
    });
  });
};
