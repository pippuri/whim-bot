'use strict';

const bus = require('../../../../lib/service-bus');
const expect = require('chai').expect;
const models = require('../../../../lib/models');
const negativeCases = require('./webhooks-bookings-update-negative-events.json');
const utils = require('../../../../lib/utils');
const positiveCases = require('./webhooks-bookings-update-positive-events.json');
const schema = require('maas-schemas/prebuilt/maas-backend/webhooks/webhooks-bookings-update/response.json');
const validator = require('../../../../lib/validator');

module.exports = function () {
  describe('webhooks-bookings-update', function () { //eslint-disable-line

    before(() => {
      return models.Database.init();
    });

    after(() => {
      return models.Database.cleanup();
    });

    describe('[POSITIVE]', () => {
      const seedBooking = {
        cost: {},
        state: 'CONFIRMED',
        terms: {},
        token: {},
        meta: {},
        customer: {
          identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
        },
      };

      positiveCases.forEach(test => {
        describe(`${test.description}`, () => {
          const event = utils.cloneDeep(test.input);
          let booking;
          let error;
          let response;

          before(() => {
            booking = utils.cloneDeep(seedBooking);
            booking.id =  utils.createId();
            booking.tspId = utils.createId();
            booking.leg = {
              to: { lat: 60.16627, lon: 24.92699, name: 'Lapinrinne' },
              from: { lat: 60.16297, lon: 24.73716, name: 'Piispansilta' }, mode: 'BUS', endTime: 1476643500000, startTime: 1476638700000,
              agencyId: test.input.agencyId,
            };

            event.payload.tspId = booking.tspId;

            return models.Booking.query().insert(booking)
              .then(() => bus.call('MaaS-webhooks-bookings-update', event))
              .then(
                res => (response = res),
                err => (error = err)
              )
              .finally(() => models.Booking.query().deleteById(booking.id));
          });

          it('should succeed without error', () => {
            expect(error).to.be.undefined;
          });

          it('should correspond the input data', () => {
            expect(response).to.not.be.undefined;
            expect(response.booking.tspId).to.equal(booking.tspId);
            expect(response.booking.state).to.equal(event.payload.state);
            expect(response.booking.token).to.deep.equal(event.payload.token);
          });

          it('should return a valid response', () => {
            return validator.validate(schema, response);
          });
        });
      });
    });

    describe('[NEGATIVE]', () => {
      const seedBooking = {
        cost: {},
        state: 'CONFIRMED',
        terms: {},
        token: {},
        meta: {},
        customer: {
          identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
        },
      };

      negativeCases.forEach(test => {
        describe(`${test.description}`, () => {
          const event = utils.cloneDeep(test.input);
          let booking;
          let error;
          let response;

          before(() => {
            booking = utils.cloneDeep(seedBooking);
            booking.id =  utils.createId();
            booking.tspId = utils.createId();
            booking.leg = {
              to: { lat: 60.16627, lon: 24.92699, name: 'Lapinrinne' },
              from: { lat: 60.16297, lon: 24.73716, name: 'Piispansilta' }, mode: 'BUS', endTime: 1476643500000, startTime: 1476638700000,
              agencyId: test.input.agencyId,
            };

            if (test.description !== 'Missing tspId in payload') {
              event.payload.tspId = booking.tspId;
            }

            return models.Booking.query().insert(booking)
              .then(() => bus.call('MaaS-webhooks-bookings-update', event))
              .then(
                res => (response = res),
                err => (error = err)
              )
              .finally(() => models.Booking.query().deleteById(booking.id));
          });

          it('should return an error, without any response', () => {
            expect(error).to.not.be.undefined;
            expect(response).to.be.undefined;
          });

          it('should produce the expected error message', () => {
            expect(error.message).to.have.string(test.errorMessage);
          });
        });
      });
    });
  });
};
