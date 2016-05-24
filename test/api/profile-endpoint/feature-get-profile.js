
var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var validator = require('./response_validator');

module.exports = function (lambda) {

  describe('query for an existing user', function () {

    var identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';
    var event = {
      identityId: identityId,
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

    it('should not raise an error', function () {
      expect(error).to.be.null;
    });

    it('should return a valid response', function () {
      var validationError = validator(response);
      expect(validationError).to.be.null;
    });

  });
};
