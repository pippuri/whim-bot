
var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var moment = require('moment');

var validator = require('../../../lib/validator');
var schema = require('../../../routes/routes-query/response-schema.json');

module.exports = function (lambda, options) {

  if (typeof options === typeof undefined) {
    options = {};
  }

  describe('leaveAt request', function () {

    var event = {
      principalId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      provider: '',
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(8).hour(17).valueOf(), // Monday one week forward around five
      arriveBy: '',
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
      return validator.validate(response, schema)
        .then((validationError) => {
          expect(validationError).to.be.null;
        });
    });

    it('response should have route', function () {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    it('response should not have legs from the past', function () {
      var tooEarly = [];
      response.plan.itineraries.forEach(itinerary => {
        itinerary.legs.forEach(leg => {
          var early = (leg.startTime - parseInt(event.leaveAt, 10));
          tooEarly.push(early);
        });
      });
      var earliest = Math.max.apply(null, tooEarly);
      var inMinutes = ((earliest / 1000) / 60);
      expect(inMinutes).to.be.below(5);
    });

    it.skip('response should have taxi legs', function () {
      var taxiLegs = [];
      response.plan.itineraries.forEach(itinerary => {
        itinerary.legs.forEach(leg => {
          if (leg.mode === 'TAXI') {
            taxiLegs.push(leg);
          }

        });
      });
      expect(taxiLegs).to.not.be.empty;
    });

  });
};
