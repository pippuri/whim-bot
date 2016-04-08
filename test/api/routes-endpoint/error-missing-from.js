
var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var moment = require('moment');

module.exports = function(lambda) {

  describe('request without "from"', function() {

    var event = {
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(8).hour(17).valueOf() // Monday one week forward around five
    }

    var error;
    var response;

    before(function(done) {
      wrap(lambda).run(event, function(err, data) {
          error = err;
          response = data;
          done();
      });
    });

    it('should raise an error', function () {
      expect(error).not.to.be.null;
    });
    it('should provide the expected error message', function () {
      expect(error.message).to.equal('Missing "from" argument.');
    });
    it('should not return a response', function () {
      expect(response).to.be.undefined;
    });

  });
}
