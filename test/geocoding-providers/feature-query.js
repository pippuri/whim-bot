var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var ajv = require('ajv')();

module.exports = function (lambda, schema, fixture) {
  describe('basic tests of a simple query', function () {
    var event = {
      hint: 'latlon',
      name: 'Kamppi Bus Station',
      count: 5,
      lat: 60.1675800,
      lon: 24.9302260,
      radius: 5,
    };
    var error;
    var response;

    before(function (done) {
      wrap(lambda).run(event, function (err, data) {
        error = err;
        response = data;
        done();
      });
    });

    it('should succeed without errors', function () {
      expect(error).to.be.null;
    });

    it('should trigger a valid response', function () {
      var valid = ajv.validate(schema, response);
      var validation_error = valid ? null : JSON.stringify(ajv.errors);
      expect(validation_error).to.be.null;
    });
  });

  fixture.forEach(function (item) {
    describe(['Search:', item.input.name, item.pass].join(' '),
      function () {
      var error;
      var response;

      before(function (done) {
        wrap(lambda).run(item.input, function (err, data) {
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

        expect(response.features.length).to.not.be.empty;
        response.features.forEach(function (feature) {
          expect(feature.properties.name).to.have.string(item.input.name);
        });
      });
    });
  });
};
