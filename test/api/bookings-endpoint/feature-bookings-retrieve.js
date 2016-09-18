'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const schema = require('maas-schemas/prebuilt/maas-backend/bookings/bookings-retrieve/response.json');
const validator = require('../../../lib/validator/index');
const moment = require('moment');
const _ = require('lodash');
const utils = require('../../../lib/utils');

module.exports = function (optionsLambda, createLambda, retrieveLambda) {

  describe('refresh an existing booking', () => {

    let response;
    let error;

    const testIdentityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    before(done => {

      // fetch options first
      const now = new Date();
      const dowTuesday = now.getDay() < 2 ? 2 : 2 + 7;
      const dowWednesday = now.getDay() < 2 ? 3 : 3 + 7;
      const nextTuesday = moment().day(dowTuesday).valueOf();
      const nextWednesday = moment().day(dowWednesday).valueOf();

      const validEvent = {
        identityId: testIdentityId,
        agencyId: 'Sixt',
        mode: 'CAR',
        from: '60.3210549,24.9506771',
        to: '',
        startTime: nextTuesday,
        endTime: nextWednesday,
      };

      // get options
      wrap(optionsLambda).run(validEvent, (_error, _response1) => {

        if (_error) {
          error = _error;
          response = _response1;

          done();
          return;
        }

        // take first option
        const newEvent = {
          payload: _.cloneDeep(_response1.options[0]),
          identityId: testIdentityId,
        };
        delete newEvent.payload.signature;
        newEvent.payload.signature = utils.sign(newEvent.payload, process.env.MAAS_SIGNING_SECRET);

        // Create a booking, then refresh it
        wrap(createLambda).run(newEvent, (_error, _response2) => {
          if (_error) {
            error = _error;
            response = _response2;

            done();
            return;
          }
          const retrieveEvent = {
            identityId: testIdentityId,
            bookingId: _response2.booking.id,
            refresh: 'true',
          };

          wrap(retrieveLambda).run(retrieveEvent, (_error, _response3) => {
            error = _error;
            response = _response3;
            done();
          });
        });
      });
    });

    it.skip('should return a valid response', () => {
      // FIXME change this when bookings are returning in correct states
      return validator.validate(schema, response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('should succeed without error', () => {
      expect(error).to.be.null;
    });
  });

};
