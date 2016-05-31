
var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var validator = require('../../../lib/validator');
var schema = require('../../../profile/profile-edit/response-schema.json');
var event = require('../../../profile/profile-edit/event.json');

module.exports = function (lambda) {

  describe('edit an existing user', function () {
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
      if (error) {
        console.warn(error.message);
        console.warn(error.stack);
      }

      expect(error).to.be.null;
    });

    it('should return a valid response', function () {
      return validator.validate(response, schema)
        .then((validationError) => {
          expect(validationError).to.be.null;
        });
    });
  });
};
