
var wrap = require('lambda-wrapper').wrap;
var expect = require('chai').expect;
var moment = require('moment');
var _ = require('lodash');

var validator = require('../../../lib/validator');
var schema = require('../../../routes/routes-query/response-schema.json');

module.exports = function (lambda, options) {

  if (typeof options === typeof undefined) {
    options = {};
  }

  describe('leaveAt request', function () {

    var event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      provider: '',
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
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
      var waitingTimes = [];
      response.plan.itineraries.forEach(itinerary => {
        itinerary.legs.forEach(leg => {
          const waitingTime = (leg.startTime - parseInt(event.leaveAt, 10));
          waitingTimes.push(waitingTime);
        });
      });
      const shortest = Math.min.apply(null, waitingTimes);
      const inMinutes = ((shortest / 1000) / 60);
      const margin = 1;
      expect(inMinutes).to.be.above(-margin);
    });

    it('response should have direct taxi route', function () {
      const itinerariesWithoutBus = response.plan.itineraries.filter(itinerary => {
        const modes = _.map(itinerary.legs, 'mode');
        if (_.includes(modes, 'BUS')) {
          return false;
        }

        return true;
      });

      const directTaxiRoutes = itinerariesWithoutBus.filter(itinerary => {
        const modes = _.map(itinerary.legs, 'mode');
        if (_.includes(modes, 'TAXI')) {
          return true;
        }

        return false;
      });

      expect(directTaxiRoutes).to.not.be.empty;
    });

    it('response itineraries should contain co2 cost', function () {
      var itinerariesWithoutCo2Cost = [];
      for (var itinerary of response.plan.itineraries) {
        if (itinerary.hasOwnProperty('fare') && itinerary.fare.hasOwnProperty('co2') && typeof itinerary.fare.co2 === typeof 123) {
          // no problem
        } else {
          itinerariesWithoutCo2Cost.push(itinerary);
        }

      }

      expect(itinerariesWithoutCo2Cost).to.be.empty;
    });

    it('response itineraries should contain point cost', function () {
      var itinerariesWithoutPointsCost = [];
      for (var itinerary of response.plan.itineraries) {
        if (itinerary.hasOwnProperty('fare') && itinerary.fare.hasOwnProperty('points') && typeof itinerary.fare.points === typeof 123) {
          // no problem
        } else {
          itinerariesWithoutPointsCost.push(itinerary);
        }

      }

      expect(itinerariesWithoutPointsCost).to.be.empty;
    });

  });
};
