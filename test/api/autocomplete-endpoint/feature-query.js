var expect = require('chai').expect;
var wrap = require('lambda-wrapper').wrap;
var validator = require('../../../lib/validator');
var schema = require('../../../autocomplete/autocomplete-query/response-schema.json');
var event = require('../../../autocomplete/autocomplete-query/event.json');

module.exports = function (lambda) {

  describe('basic query', function () {

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
      return validator.validate(response, schema)
        .then((validationError) => {
          expect(validationError).to.be.null;
        });
    });
  });
};
