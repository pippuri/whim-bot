
var expect = require('chai').expect;

module.exports = function (engine) {

  describe('query with an unknown plan id', function () {

    var plans = ['plan1', 'unknown plan id'];

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

    it('should return null', function () {
      expect(error).to.not.be.undefined;
    });

    it('should provide the expected error message', function () {
      expect(error.message).contains('Unknown plan: ');
    });

    it('should not return a response', function () {
      expect(response).to.be.undefined;
    });

  });
};
