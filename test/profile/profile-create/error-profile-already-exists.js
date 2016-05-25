
var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;

module.exports = function (lambda) {

  describe('for an existing user', function () {

    var identityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    var event = {
      identityId: identityId,
      payload: {
        name: 'Dummy Profile',
      },
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

    it.skip('should raise an error', function () {
      const errorMessage = '' + error;
      expect(errorMessage).to.contain('User Existed');
    });

    it('should not return a response', function () {
      expect(response).to.be.undefined;
    });

  });
};
