
var expect = require('chai').expect;
var moment = require('moment');

var validator = require('./response_validator');

module.exports = function(handler) {

  describe('arriveBy request', function() {

    var late_margin = 58; // minutes (< 60 to make sure we catch time zone problems)

    var event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      arriveBy: '' + moment().isoWeekday(8).hour(17).valueOf() // Monday one week forward around five
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
    it('response route suggestions should be max ' + late_margin + ' minutes late', function () {
      response.plan.itineraries.forEach(function(i) {
        var late_ms = (parseInt(i.endTime, 10) - parseInt(event.arriveBy));
        var late_s = late_ms / 1000;
        var late_m = Math.floor(late_s / 60);
        expect(late_m).to.be.below(late_margin);
      });
    });

  });
}
