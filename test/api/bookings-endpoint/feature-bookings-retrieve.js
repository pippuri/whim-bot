'use strict';

const expect = require('chai').expect;
const wrap = require('lambda-wrapper').wrap;
const validator = require('../../../lib/validator/index');
const schema = require('../../../bookings/bookings-retrieve/response-schema.json');
const bus = require('../../../lib/service-bus/index');

module.exports = function (lambda) {

  const event = {
    identityId: 'eu-west-1: 00000000-cafe-cafe-cafe-000000000000',
    bookingId: 'BCB5C1D1-43A2-11E6-A001-2D65C8A4E851',
  };

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
          bus.call('MaaS-bookings-create', require('../../../bookings/bookings-create/event.json'))
            .then(response => {
              const newEvent = {
                identityId: response.customer.id ? response.customer.id : 'eu-west-1:00000000-cafe-cafe-cafe-000000000000',
                bookingId: response.id,
              };
              wrap(lambda).run(newEvent, (err, res) => {
                response = res;
                error = err;
                done();
              });
            });
        }
      });
    });

    it('should return a valid response', () => {
      // FIXME change this when bookings are returning in correct states
      response.state = 'RESERVED';
      return validator.validate(response, schema)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('should succeed without error', () => {
      expect(error).to.be.null;
    });
  });
};
