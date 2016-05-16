var chai = require('chai');
var expect = chai.expect;
var wrap = require('lambda-wrapper').wrap;

var validator = require('../../lib/validator');
var schema = require('../../autocomplete/autocomplete-query/response-schema.json');

module.exports = function (lambda) {

  describe('autocomplete request', function () {

    var event = {
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

    before(function (done) {
      wrap(lambda).run(event, function (err, data) {
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
        .then(function (validationError) {
          expect(validationError).to.be.null;
        });
    });
  });
};
