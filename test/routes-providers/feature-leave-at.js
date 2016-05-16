var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var moment = require('moment');
var validator = require('../../lib/validator');
var schema = require('../../routes/routes-query/response-schema.json');

module.exports = function (lambda, options) {

  if (typeof options === typeof undefined) {
    options = {};
  }

  describe('leaveAt request', function () {

    var event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
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

    if (options.taxiSupport === true) {
      it('response should have taxi legs', function () {
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
    }
  });
};
