
var expect = require('chai').expect;
var moment = require('moment');

module.exports = function(handler) {

  describe('request with both "leaveAt" and "arriveBy"', function() {

    var event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(8).hour(17).valueOf(), // Monday one week forward around five
      arriveBy: '' + moment().isoWeekday(8).hour(21).valueOf() // Monday one week forward around nine
    }

    var error;
    var response;

    before(function(done) {
      handler(event, {
        done: function(e, r) {
          error = e;
          response = r;
          done();
        }
      });
    });

    it('should raise an error', function () {
      expect(error).not.to.be.null;
    });
    it('should provide the expected error message', function () {
      expect(error.message).to.equal('Both "leaveAt" and "arriveBy" provided.');
    });
    it('should not return a response', function () {
      expect(response).to.be.undefined;
    });

  });
}
