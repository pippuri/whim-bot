'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const moment = require('moment');
const _ = require('lodash');

const validator = require('../../../lib/validator');
const schema = require('../../../routes/routes-query/response-schema.json');

module.exports = (lambda, options) => {

  if (typeof options === typeof undefined) {
    options = {};
  }

  describe('leaveAt request', function () {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      provider: '',
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
      arriveBy: '',
    };

    let error;
    let response;

    before(done => {
      wrap(lambda).run(event, (err, data) => {
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
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('response should have route', function () {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    it('response should not have legs from the past', function () {
      const waitingTimes = [];
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

    it('all response itineraries should contain fare', function () {
      const itinerariesWithoutFare = response.plan.itineraries.filter(itinerary => {
        if (itinerary.hasOwnProperty('fare')) {
          return false;
        }

        return true;
      });

      expect(itinerariesWithoutFare).to.be.empty;
    });

    it('some response itineraries should contain point cost', function () {

      // It is OK for some routes to have null cost but we should be able to provide
      // some route from SC5 Office to Gallows Bird Pub for a point cost.

      const itinerariesWithPointsCost = response.plan.itineraries.filter(itinerary => {
        if (itinerary.fare.points !== null) {
          return true;
        }

        return false;
      });

      expect(itinerariesWithPointsCost).to.not.be.empty;
    });

  });
};
