'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const moment = require('moment');
const validator = require('../../../lib/validator');
const _ = require('lodash');

module.exports = (lambda, options) => {

  if (typeof options === typeof undefined) {
    options = {};
  }

  describe('leaveAt request', () => {

    const event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().isoWeekday(7).add(1, 'days').hour(17).valueOf(), // Monday one week forward around five
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

    xit('should trigger a valid response', () => {
      return validator.validate('maas-backend:routes-query-response', response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('response should have route', () => {
      expect(response.plan.itineraries).to.not.be.empty;
    });

    if (options.taxiSupport === true) {
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
    }
  });
};
