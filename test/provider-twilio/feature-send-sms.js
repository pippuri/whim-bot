var chai = require('chai');
var expect = chai.expect;
var wrap = require('lambda-wrapper').wrap;
var event = require('../../provider-twilio/provider-twilio-send-sms/event.json');

module.exports = function (lambda) {

  describe('send-sms request', function () {
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
  });
};
