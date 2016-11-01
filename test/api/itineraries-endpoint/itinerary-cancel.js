'use strict';

const _ = require('lodash');
const creationEvent = require('../../../itineraries/itinerary-create/event.json');
const expect = require('chai').expect;
const schema = require('maas-schemas/prebuilt/maas-backend/itineraries/itinerary-cancel/response.json');
const signatures = require('../../../lib/signatures');
const utils = require('../../../lib/utils');
const validator = require('../../../lib/validator');
const wrap = require('lambda-wrapper').wrap;


module.exports = function (createLambda, cancelLambda) {

  describe('cancel an itinerary, created by itinerary create', () => {
    let error;
    let response;

    before(done => {
      // Sign the event data (Travis seems to have problems repeating the signatures)
      const newEvent = _.cloneDeep(creationEvent);
      delete newEvent.itinerary.signature;
      newEvent.itinerary.signature = signatures.sign(newEvent.itinerary, process.env.MAAS_SIGNING_SECRET);

      // Create an itinerary, then cancel it
      wrap(createLambda).run(newEvent, (_error, _response) => {
        if (_error) {
          error = _error;
          response = _response;

          done();
          return;
        }

        const cancelEvent = {
          identityId: newEvent.identityId,
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
        console.log(`Caught an error: ${error.message}`);
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

    it('should have all itineraries, legs and bookings in cancelled state', () => {
      const itinerary = response.itinerary;
      expect(itinerary.state).to.be.oneOf(['CANCELLED', 'CANCELLED_WITH_ERRORS']);

      itinerary.legs.forEach(leg => {
        expect(leg.state).to.be.oneOf(['CANCELLED', 'CANCELLED_WITH_ERRORS']);

        // Don't validate bookings, as they may fail to cancel (which is acceptable)
        /*const booking = leg.booking;
        if (typeof booking !== typeof undefined) {
          expect(booking.state).to.be.oneOf(['CANCELLED', 'CANCELLED_WITH_ERRORS']);
        }*/
      });
    });

    xit('should only cancel cancellable legs', () => {
      // TODO Not implemented (needs leg state toggling elsewhere)
    });
  });
};
