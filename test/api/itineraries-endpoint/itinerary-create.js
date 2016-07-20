'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const validator = require('../../../lib/validator');
const schema = require('../../../itineraries/itinerary-create/response-schema.json');
const utils = require('../../../lib/utils');
const event = require('../../../itineraries/itinerary-create/event.json');
const moraEvent = require('./itinerary-mora-orsa.json');

module.exports = function (lambda) {

  describe('create itinerary with known agencies', () => {
    let error;
    let response;

    before(done => {
      // Sign the event data (Travis seems to have problems repeating the signatures)
      const newItinerary = Object.assign({}, event.itinerary);
      delete newItinerary.signature;
      event.itinerary.signature = utils.sign(newItinerary, process.env.MAAS_SIGNING_SECRET);

      wrap(lambda).run(event, (_error, _response) => {
        error = _error;
        response = _response;
        done();
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
  });

  describe('create itinerary with unknown agencies', () => {
    let error;
    let response;

    before(done => {
      // Sign the event data (Travis seems to have problems repeating the signatures)
      const newItinerary = Object.assign({}, moraEvent.itinerary);
      delete newItinerary.signature;
      moraEvent.itinerary.signature = utils.sign(newItinerary, process.env.MAAS_SIGNING_SECRET);

      wrap(lambda).run(moraEvent, (_error, _response) => {
        error = _error;
        response = _response;
        done();
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
  });
};
