'use strict';

const _ = require('lodash');
const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const schema = require('maas-schemas/prebuilt/maas-backend/itineraries/itinerary-list/response.json');
const validator = require('../../../lib/validator');
const utils = require('../../../lib/utils');
const creationEvent = require('../../../itineraries/itinerary-create/event.json');

module.exports = function (createLambda, listLambda) {

  describe('retrieve one or more itineraries, created by itinerary create', () => {
    let error;
    let response;

    before(done => {
      // Sign the event data (Travis seems to have problems repeating the signatures)
      const newEvent = _.cloneDeep(creationEvent);
      const timeDiff = creationEvent.itinerary.endTime - creationEvent.itinerary.startTime;
      newEvent.itinerary.startTime = Date.now();
      newEvent.itinerary.endTime = newEvent.itinerary.startTime + timeDiff;

      delete newEvent.itinerary.signature;
      newEvent.itinerary.signature = utils.sign(newEvent.itinerary, process.env.MAAS_SIGNING_SECRET);

      // Create an itinerary, then cancel it
      wrap(createLambda).run(newEvent, (_error, _response) => {
        if (_error) {
          error = _error;
          response = _response;

          done();
          return;
        }

        const listEvent = {
          identityId: newEvent.identityId,
          startTime: String(_response.itinerary.startTime),
          endTime: String(_response.itinerary.endTime),
          states: String(_response.itinerary.state),
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
      return validator.validate(schema, response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });
  });
};
