'use strict';

const _ = require('lodash');
const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const validator = require('../../../lib/validator');
const utils = require('../../../lib/utils');
const creationEvent = require('../../../bookings/bookings-create/event.json');

module.exports = function (createLambda, listLambda) {

  describe('retrieve one or more bookings, created by bookings create', () => {
    let error;
    let response;

    before(done => {
      // Sign the event data (Travis seems to have problems repeating the signatures)
      const newEvent = _.cloneDeep(creationEvent);
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

    it('should succeed without errors', () => {
      if (error) {
        console.log(error);
        console.log(error.stack);
      }

      expect(error).to.be.null;
    });

    xit('should trigger a valid response', () => {
      return validator.validate('maas-backend:bookings-list-response', response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });
  });
};
