var expect = require('chai').expect;
var wrap = require('lambda-wrapper').wrap;

var validator = require('./response_validator');

module.exports = function (lambda) {

  describe('autocomplete request', function () {

    var event = {
      hint: 'latlon',
      name: 'Kamppi',
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

    it('should be successful', function () {
      expect(error).to.be.null;
    });

    it('should trigger a valid response', function () {
      var validationError = validator(response);
      expect(validationError).to.be.null;
    });

  });

};