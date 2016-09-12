'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const schema = require('maas-schemas/prebuilt/maas-backend/bookings/bookings-retrieve/response.json');
const validator = require('../../../lib/validator/index');
const Database = require('../../../lib/models/index').Database;

module.exports = function (lambda) {

  const event = {
    identityId: 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
    bookingId: '84174750-4CF7-11E6-9C1D-4D511BCD104A',
  };

  describe('refresh an existing booking', () => {

    let response;
    let error;

    before(done => {
      wrap(lambda).run(event, (err, res) => {

        if (!err) {
          response = res;
          error = err;
          done();
        } else {
          // Try to create a dummy booking if somehow the dummy wasn't already there
          Database.init()
            .then(_knex => {
              return _knex.insert({
                id: event.bookingId,
                tspId: '3387',
                state: 'RESERVED',
                leg: { dummy: 'dummy', agencyId: 'Valopilkku', state: 'PLANNED' },
                customer: { identityId: event.identityId },
                token: { dummy: 'dummy' },
                terms: { dummy: 'dummy' },
                meta: { dummy: 'dummy' },

              })
              .into('Booking')
              .returning(['customer', 'id']);
            })
            .then(response => {
              const newEvent = {
                identityId: response[0].customer.identityId ? response[0].customer.identityId : 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
                bookingId: response[0].id,
                refresh: true,
              };
              // And then test with this new repsonse booking
              wrap(lambda).run(newEvent, (err, res) => {
                response = res;
                error = err;
                done();
              });
            });
        }
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

  describe('retrieve an existing booking', () => {

    let response;
    let error;

    before(done => {
      wrap(lambda).run(event, (err, res) => {
        if (!err) {
          response = res;
          error = err;
          done();
        } else {
          // Try to create a dummy booking if somehow the dummy wasn't already there
          Database.init()
            .then(_knex => {
              return _knex.insert({
                id: event.bookingId,
                tspId: '3387',
                state: 'RESERVED',
                leg: { dummy: 'dummy', agencyId: 'Valopilkku', state: 'PLANNED' },
                customer: { identityId: event.identityId },
                token: { dummy: 'dummy' },
                terms: { dummy: 'dummy' },
                meta: { dummy: 'dummy' },

              })
              .into('Booking')
              .returning(['customer', 'id']);
            })
            .then(response => {
              const newEvent = {
                identityId: response[0].customer.identityId ? response[0].customer.identityId : 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
                bookingId: response[0].id,
              };
              // And then test with this new repsonse booking
              wrap(lambda).run(newEvent, (err, res) => {
                console.log('a', res);
                response = res;
                error = err;
                done();
              });
            });
        }
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
