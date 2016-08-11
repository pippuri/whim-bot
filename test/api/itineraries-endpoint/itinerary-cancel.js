'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const validator = require('../../../lib/validator');
const utils = require('../../../lib/utils');
const schema = require('../../../itineraries/itinerary-cancel/response-schema.json');
const creationEvent = require('../../../itineraries/itinerary-create/event.json');

module.exports = function (createLambda, cancelLambda) {

  describe('cancel an itinerary, created by itinerary create', () => {
    let error;
    let response;

    before(done => {
      // Sign the event data (Travis seems to have problems repeating the signatures)
      const newItinerary = Object.assign({}, creationEvent.itinerary);
      delete newItinerary.signature;
      creationEvent.itinerary.signature = utils.sign(newItinerary, process.env.MAAS_SIGNING_SECRET);

      // Create an itinerary, then cancel it
      wrap(createLambda).run(creationEvent, (_error, _response) => {
        if (_error) {
          error = _error;
          response = _response;

          done();
          return;
        }

        const cancelEvent = {
          identityId: creationEvent.identityId,
          itineraryId: _response.itinerary.id,
        };

        wrap(cancelLambda).run(cancelEvent, (_error, _response) => {
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

    it('should trigger a valid response', () => {
      return validator.validate(response, schema)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });

    it('should have all itineraries, legs and bookings in cancelled state', () => {
      const itinerary = response.itinerary;
      expect(itinerary.state).to.equal('CANCELLED');

      itinerary.legs.forEach(leg => {
        expect(leg.state).to.equal('CANCELLED');
        const booking = leg.booking;

        if (typeof booking !== typeof undefined) {
          expect(booking.state).to.equal('CANCELLED');
        }
      });
    });
  });
};
