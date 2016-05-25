
var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;

module.exports = function (lambda) {

  describe('for a nonexistent user', function () {

    var randomHex = ('0000' + (Math.random() * 0xffff).toString(16)).slice(-4);
    var identityId = 'eu-west-1:00000000-dead-' + randomHex + '-dead-000000000000';

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

    it.skip('should not raise an error', function () {
      expect(error).to.be.null;
    });

    it.skip('should return an empty object', function () {
      expect(response).to.deep.equal({});
    });

  });
};
