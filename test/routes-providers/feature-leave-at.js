
var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var moment = require('moment');

var validator = require('./response_validator');

module.exports = function(lambda) {

  describe('leaveAt request', function() {

    var early_margin = 58; // minutes (< 60 to make sure we catch time zone problems)

    var event = {
      from: '60.1684126,24.9316739', // SC5 Office
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

    it('should succeed without errors', function () {
      expect(error).to.be.null;
    });
    it('should trigger a valid response', function () {
      var validation_error = validator(response);
      expect(validation_error).to.be.null;
    });

    it('response should have route', function () {
      expect(response.plan.itineraries.length).to.not.be.empty;
    });
    it('response route suggestions should be max ' + early_margin + ' minutes early', function () {
      response.plan.itineraries.forEach(function(i) {
          var early_ms = (parseInt(event.leaveAt, 10) - parseInt(i.startTime, 10));
          var early_s = early_ms / 1000;
          var early_m = Math.floor(early_s / 60);
          expect(early_m).to.be.below(early_margin);
      });
    });

  });
}
