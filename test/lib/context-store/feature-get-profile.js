
var expect = require('chai').expect;
var validator = require('./response_validator');

module.exports = function (store) {

  describe('query for an existing user', function () {

    var principalId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    var error;
    var response;

    before(function (done) {
      store.get(principalId).then(data => {
        response = data;
        done();
      }).catch(data => {
        error = data;
        done();
      });
    });

    it('should not raise an error', function () {
      expect(error).to.be.undefined;
    });

    it('should return a valid response', function () {
      var validationError = validator(response);
      expect(validationError).to.be.null;
    });

  });
};
