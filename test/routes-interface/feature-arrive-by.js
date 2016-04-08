
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
    it('response should be valid', function () {
      var ajvFactory = require('ajv');
      var schema = require('./schema.json');
      var ajv = ajvFactory();
      var validate = ajv.compile(schema);
      var valid = validate(response);
      var validation_error = valid ? null : JSON.stringify(validate.errors);
      expect(validation_error).to.be.null;
    });
    it('response should have route', function () {
      expect(response.plan.itineraries.length).to.not.be.empty;
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
