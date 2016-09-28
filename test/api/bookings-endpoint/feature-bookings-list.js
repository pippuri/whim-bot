'use strict';

const _ = require('lodash');
const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const schema = require('maas-schemas/prebuilt/maas-backend/bookings/bookings-list/response.json');
const validator = require('../../../lib/validator');
const utils = require('../../../lib/utils');
const moment = require('moment');
const models = require('../../../lib/models');
const Database = models.Database;

module.exports = function (optionsLambda, createLambda, listLambda) {

  const testIdentityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';

  describe('retrieve one or more bookings, created by bookings create', () => {
    let error;
    let response;
    let bookingId;

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

      wrap(optionsLambda).run(validEvent, (err, data) => {

        if (err) {
          error = err;
          response = data;

          done();
          return;
        }

        // take first option
        const newEvent = {
          payload: _.cloneDeep(data.options[0]),
          identityId: testIdentityId,
        };
        delete newEvent.payload.signature;
        newEvent.payload.signature = utils.sign(newEvent.payload, process.env.MAAS_SIGNING_SECRET);

        // Create a booking, then cancel it
        wrap(createLambda).run(newEvent, (_error, _response) => {
          if (_error) {
            error = _error;
            response = _response;

            done();
            return;
          }

          bookingId = _response.booking.id;

          const testIdentityId = 'eu-west-1:00000000-cafe-cafe-cafe-000000000000';
          const listEvent = {
            identityId: testIdentityId,
            startTime: String(_response.booking.startTime),
            endTime: String(_response.booking.endTime),
            states: String(_response.booking.state),
          };

          wrap(listLambda).run(listEvent, (_error, _response) => {
            error = _error;
            response = _response;
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
        } )
        .then(() => Database.cleanup());
    });

    it('should succeed without errors', () => {
      if (error) {
        console.log(error);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    xit('should trigger a valid response', () => {
      return validator.validate(schema, response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });
  });
};
