'use strict';

const _ = require('lodash');
const expect = require('chai').expect;
const schema = require('maas-schemas/prebuilt/maas-backend/itineraries/itinerary-list/response.json');
const signatures = require('../../../lib/signatures');
const validator = require('../../../lib/validator');
const wrap = require('lambda-wrapper').wrap;


const creationEvent = require('../../../itineraries/itinerary-create/event.json');

module.exports = function (createLambda, retrieveLambda) {

  describe('retrieve an itinerary, created by itinerary create', () => {
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

        const retrieveEvent = {
          identityId: newEvent.identityId,
          itineraryId: _response.itinerary.id,
        };

        wrap(retrieveLambda).run(retrieveEvent, (_error, _response) => {
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
  });
};
