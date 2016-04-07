
var expect = require('chai').expect;
var moment = require('moment');

module.exports = function(handler) {

  describe('arriveBy request', function() {

    var from = '60.1684126,24.9316739'; // SC5 Office
    var to = '60.170779,24.7721584'; // Gallows Bird Pub
    var arriveBy = moment().isoWeekday(8).hour(17).valueOf(); // Monday one week forward around five

    var late_margin = 58; // minutes (< 60 to make sure we catch time zone problems)

    var error;
    var response;

    before(function(done) {
      var event = {
        from: from,
        to: to,
        arriveBy: '' + arriveBy
      }
      handler(event, {
        done: function(e, r) {
          error = e;
          response = r;
          done();
        }
      });
    });

    it('should succeed', function () {
      expect(error).to.be.null;
    });
    it('should get response', function () {
      expect(response).to.be.an('object');
    });
    it('response should have route', function () {
      expect(response.plan.itineraries.length).to.not.be.empty;
    });
    it('response itineries should have startTime', function () {
      response.plan.itineraries.forEach(function(i) {
          expect(i.startTime).to.be.a('number');
      });
    });
    it('response itineries should have endTime', function () {
      response.plan.itineraries.forEach(function(i) {
          expect(i.endTime).to.be.a('number');
      });
    });
    it('response route suggestions should be max ' + late_margin + ' minutes late', function () {
      response.plan.itineraries.forEach(function(i) {
        var late_ms = (parseInt(i.endTime, 10) - arriveBy);
        var late_s = late_ms / 1000;
        var late_m = Math.floor(late_s / 60);
        expect(late_m).to.be.below(late_margin);
      });
    });
  });
}
