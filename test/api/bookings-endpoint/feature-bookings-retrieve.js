'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const schema = require('maas-schemas/prebuilt/maas-backend/bookings/bookings-retrieve/response.json');
const validator = require('../../../lib/validator/index');
const moment = require('moment');
const _ = require('lodash');
const utils = require('../../../lib/utils');
const models = require('../../../lib/models');
const Database = models.Database;

module.exports = function (optionsLambda, createLambda, retrieveLambda) {

  describe('refresh an existing booking', () => {

    let event;
    let response;
    let error;
    let bookingId;

    const testIdentityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

    before(done => {

      // fetch options first
      const now = new Date();
      const dowTuesday = now.getDay() < 2 ? 2 : 2 + 7;
      const dowWednesday = now.getDay() < 2 ? 3 : 3 + 7;
      const nextTuesday = moment().day(dowTuesday).valueOf();
      const nextWednesday = moment().day(dowWednesday).valueOf();

      event = {
        identityId: testIdentityId,
        agencyId: 'Sixt',
        mode: 'CAR',
        from: '60.3210549,24.9506771',
        to: '',
        startTime: nextTuesday,
        endTime: nextWednesday,
      };

      // get options
      wrap(optionsLambda).run(event, (_error, _response1) => {
        error = _error;
        response = _response1;

        if (_error) {
          error = _error;
          response = _response1;

          done();
          return;
        }

        // Take the first option
        event = {
          payload: _.cloneDeep(_response1.options[0]),
          identityId: testIdentityId,
        };
        delete event.payload.signature;
        event.payload.signature = utils.sign(event.payload, process.env.MAAS_SIGNING_SECRET);

        // Create a booking, then refresh it
        wrap(createLambda).run(event, (_error, _response2) => {
          if (_error) {
            error = _error;
            response = _response2;

            done();
            return;
          }

          bookingId = _response2.booking.id;

          event = {
            identityId: testIdentityId,
            bookingId: _response2.booking.id,
            refresh: 'true',
          };

          wrap(retrieveLambda).run(event, (_error, _response3) => {
            error = _error;
            response = _response3;
            done();
          });
        });
      });
    });

    after(() => {
      return Database.init()
        .then(() => {
          if (bookingId) {
            return models.Booking.query().delete().where('id', bookingId);
          }
          return Promise.resolve();
        })
        .then(() => Database.cleanup());
    });

    it.skip('should return a valid response', () => {
      // FIXME change this when bookings are returning in correct states
      return validator.validate(schema, response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('should succeed without error', () => {
      if (error) {
        console.log(`Caught an error: ${error.message}`);
        console.log(`Event: ${JSON.stringify(event)}`);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });
  });
};
