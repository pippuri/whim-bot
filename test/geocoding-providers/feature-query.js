'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const ajv = require('ajv')({ verbose: true });

module.exports = (lambda, schema, fixture) => {
  describe('basic tests of a simple query', function () {
    const event = {
      hint: 'latlon',
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

    it('should succeed without errors', function () {
      expect(error).to.be.null;
    });

    it('should trigger a valid response', function () {
      const valid = ajv.validate(schema, response);
      const validationError = valid ? null : JSON.stringify(ajv.errors);
      expect(validationError).to.be.null;
    });
  });

  fixture.forEach(item => {
    describe(['Search:', item.input.name, item.pass].join(' '),
      function () {
      let error;
      let response;

      before(done => {
        wrap(lambda).run(item.input, (err, data) => {
          error = err;
          response = data;
          done();
        });
      });

      it('should have a valid answer', function () {
        if (!item.pass) {
          expect(error).to.not.be.null;
          return;
        }

        expect(response.features).to.not.be.empty;
        response.features.forEach(feature => {
          expect(feature.properties.name).to.have.string(item.input.name);
        });
      });
    });
  });
};
