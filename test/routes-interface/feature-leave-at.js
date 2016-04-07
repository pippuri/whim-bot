
var expect = require('chai').expect;
var moment = require('moment');

module.exports = function(handler) {

  describe('leaveAt request', function() {

    var from = '60.1684126,24.9316739'; // SC5 Office
    var to = '60.170779,24.7721584'; // Gallows Bird Pub
    var leaveAt = moment().isoWeekday(8).hour(17).valueOf(); // Monday one week forward around five

    var early_margin = 58; // minutes (< 60 to make sure we catch time zone problems)

    var error;
    var response;

    before(function(done) {
      var event = {
        from: from,
        to: to,
        leaveAt: '' + leaveAt
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
    it('response route suggestions should be max ' + early_margin + ' minutes early', function () {
      response.plan.itineraries.forEach(function(i) {
          var early_ms = (leaveAt - parseInt(i.startTime, 10));
          var early_s = early_ms / 1000;
          var early_m = Math.floor(early_s / 60);
          expect(early_m).to.be.below(early_margin);
      });
    });
  });
}
