
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
