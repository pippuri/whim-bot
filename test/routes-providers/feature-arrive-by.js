
var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var moment = require('moment');

var validator = require('./response_validator');

module.exports = function (lambda) {

  describe('arriveBy request', function () {

    var lateMargin = 58; // minutes (< 60 to make sure we catch time zone problems)

    var event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      arriveBy: '' + moment().isoWeekday(8).hour(17).valueOf(), // Monday one week forward around five
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

    it('should succeed without errors', function () {
      expect(error).to.be.null;
    });

    it('should trigger a valid response', function () {
      var validationError = validator(response);
      expect(validationError).to.be.null;
    });

    it('response should have route', function () {
      expect(response.plan.itineraries.length).to.not.be.empty;
    });

    it('response route suggestions should be max ' + lateMargin + ' minutes late', function () {
      response.plan.itineraries.forEach(function (i) {
        var lateMillis = (parseInt(i.endTime, 10) - parseInt(event.arriveBy));
        var lateSeconds = lateMillis / 1000;
        var lateMinutes = Math.floor(lateSeconds / 60);
        expect(lateMinutes).to.be.below(lateMargin);
      });
    });

  });
};
