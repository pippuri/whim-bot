
var expect = require('chai').expect;
var validator = require('./response_validator');

module.exports = function (engine) {

  describe('query for defined plans', function () {

    var plans = ['plan1', 'plan2'];

    var error;
    var response;

    before(function (done) {
      engine.get(plans).then(data => {
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
