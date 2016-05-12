
var expect = require('chai').expect;
var validator = require('./response_validator');
var DEFAULT_CONTEXT = {
  activePlans: ['plan1'],
};

module.exports = function (store) {

  describe('query for a nonexisting user', function () {

    var randomHex = ('0000' + (Math.random() * 0xffff).toString(16)).slice(-4);
    var principalId = 'eu-west-1:00000000-dead-' + randomHex + '-dead-000000000000';

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

    it('should return default context', function () {
      expect(response).to.deep.equal(DEFAULT_CONTEXT);
    });

  });
};
