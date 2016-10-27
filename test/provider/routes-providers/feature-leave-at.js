'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const moment = require('moment-timezone');
const schema = require('maas-schemas/');
const validator = require('../../../lib/validator');

module.exports = (lambda, options) => {

  if (typeof options === typeof undefined) {
    options = {};
  }

  describe('leaveAt request', () => {

    const event = {
      from: '60.1684126,24.9316739', // SC5 Office
      to: '60.170779,24.7721584', // Gallows Bird Pub
      leaveAt: '' + moment().tz('Europe/Helsinki').day(8).hour(17).valueOf(), // Monday one week forward around five
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
      return validator.validate(schema, response)
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
          const modes = itinerary.legs.map(leg => leg.mode);

          for (let mode of modes) { // eslint-disable-line prefer-const
            if (allowed.indexOf(mode) === -1) {
              return false;
            }
          }

          return true;
        });

        const directTaxiRoutes = itinerariesWithAllowedModes.filter(itinerary => { // eslint-disable-line no-unused-vars
          const modes = itinerary.legs.map(leg => leg.mode);
          if (modes.indexOf('TAXI') !== -1) {
            return true;
          }

          return false;
        });
        expect(itinerariesWithAllowedModes).to.not.be.empty;
      });
    }
  });
};
