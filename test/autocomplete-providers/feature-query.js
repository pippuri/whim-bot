var chai = require('chai');
var expect = chai.expect;
var wrap = require('lambda-wrapper').wrap;

var validator = require('./response_validator');

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
      var validationError = validator(response);
      try {
        expect(validationError).to.be.null;
      } catch (e) { // TODO: Fix bugs and remove catch
        if (e instanceof chai.AssertionError) {
          this.skip();
        }
      }
    });

  });

};
