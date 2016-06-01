
const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const validator = require('./response_validator');

module.exports = function (lambda) {

  describe('query for an existing user', function () {

    const identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';
    const event = {
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
      const validationError = validator(response);
      expect(validationError).to.be.null;
    });

  });
};
