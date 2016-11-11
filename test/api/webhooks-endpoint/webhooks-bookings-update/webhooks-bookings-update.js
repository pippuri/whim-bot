'use strict';

const expect = require('chai').expect;
const models = require('../../../../lib/models');
const bus = require('../../../../lib/service-bus');
const utils = require('../../../../lib/utils');
const negativeEvents = require('./webhooks-bookings-update-negative-events.json');
const positiveEvents = require('./webhooks-bookings-update-positive-events.json');

module.exports = function () {

  describe('Webhooks-bookings-update', function () {

    this.timeout(20000);

    describe('[POSITIVE]', () => {

      const seedBooking = {
        id: utils.createId(),
        tspId: utils.createId() + Math.floor(Math.random() * (10 - 2) + 2), // Append random number to make sure it is unique
        cost: {},
        state: 'RESERVED',
        terms: {},
        token: {},
        meta: {},
      };

      positiveEvents.forEach(event => {

        describe(`${event.description}`, () => {

          let error;
          let response;

          before(() => {
            seedBooking.leg = {
              agencyId: event.input.agencyId,
            };
            event.input.payload.tspId = seedBooking.tspId;
            return models.Database.init()
              .then(() => models.Booking.query().insert(seedBooking))
              .then(() => bus.call('MaaS-webhooks-bookings-update', event.input))
              .then(res => {
                response = res;
              })
              .catch(err => {
                error = err;
              })
              .finally(() => {
                return models.Booking.query()
                  .delete()
                  .where('id', seedBooking.id);
              });
          });

          it('should succeed without error', () => {
            expect(error).to.be.undefined;
          });

          it('should return a valid response', () => {
            expect(response).to.not.be.undefined;
            expect(response.tspId).to.equal(seedBooking.tspId);
            expect(response.state).to.equal(event.input.payload.state);
            expect(response.token).to.deep.equal(event.input.payload.token);
          });
        });
      });
    });

    describe('[NEGATIVE]', () => {

      const seedBooking = {
        id: utils.createId(),
        tspId: utils.createId() + Math.floor(Math.random() * (10 - 2) + 2), // Append random number to make sure it is unique
        cost: {},
        state: 'RESERVED',
        terms: {},
        token: {},
        meta: {},
      };

      negativeEvents.forEach(event => {

        describe(`${event.description}`, () => {

          let error;
          let response;

          before(() => {
            seedBooking.leg = {
              agencyId: event.input.agencyId,
            };
            if (event.description !== 'Missing tspId in payload') {
              event.input.payload.tspId = seedBooking.tspId;
            }
            return models.Database.init()
              .then(() => models.Booking.query().insert(seedBooking))
              .then(() => bus.call('MaaS-webhooks-bookings-update', event.input))
              .then(res => {
                response = res;
              })
              .catch(err => {
                error = err;
              })
              .finally(() => {
                return models.Booking.query()
                  .delete()
                  .where('id', seedBooking.id)
                  .then(() => models.Database.cleanup());
              });
          });

          it('should return an error, without any response', () => {
            expect(error).to.not.be.undefined;
            expect(response).to.be.undefined;
          });

          it('should produce the expected error message', () => {
            expect(error.message).to.equal(event.errorMessage);
          });
        });
      });
    });
  });
};
