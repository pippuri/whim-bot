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

  describe('route request from Orsa to Mora', () => {

    const event = {
      identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
      from: '61.0104906,14.5614225', // Hotell Kung Gösta, Mora
      to: '61.1192448,14.6194989', // Systembolaget, Orsa
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

    it('should succeed without errors', () => {
      expect(error).to.be.null;
    });

    it('should trigger a valid response', () => {
      return validator.validate(response, schema)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('response should have route', () => {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    it('response should have direct taxi route', () => {

      const allowed = ['TAXI', 'WALK', 'WAIT', 'TRANSFER', 'LEG_SWITCH'];

      const itinerariesWithAllowedModes = response.plan.itineraries.filter(itinerary => {
        const modes = _.map(itinerary.legs, 'mode');

        for (let mode of modes) { // eslint-disable-line prefer-const

          if (!_.includes(allowed, mode)) {
            return false;
          }

        }

        return true;
      });

      const directTaxiRoutes = itinerariesWithAllowedModes.filter(itinerary => {
        const modes = _.map(itinerary.legs, 'mode');
        if (_.includes(modes, 'TAXI')) {
          return true;
        }

        return false;
      });

      expect(directTaxiRoutes).to.not.be.empty;
    });

    it.skip('itineraries with taxi legs should not have agencyId Valopilkku', () => {

      // Valopilkku does not provide taxis in Sweden at the moment

      const taxiLegs = _.flatten(response.plan.itineraries.map(itinerary => {
        return itinerary.legs.filter(leg => {
          if (leg.mode === 'TAXI') {
            return true;
          }

          return false;
        });
      }));

      const valopilkkuTaxiLegs = taxiLegs.filter(leg => {
        if (leg.agencyId === 'Valopilkku') {
          return true;
        }

        return false;
      });

      expect(valopilkkuTaxiLegs).to.be.empty;
    });

  });
};
