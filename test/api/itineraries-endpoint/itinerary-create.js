'use strict';

const wrap = require('lambda-wrapper').wrap;
const expect = require('chai').expect;
const schema = require('maas-schemas/prebuilt/maas-backend/itineraries/itinerary-create/response.json');
const validator = require('../../../lib/validator');
const _ = require('lodash');
const utils = require('../../../lib/utils');
const event = require('../../../itineraries/itinerary-create/event.json');
const moraEvent = require('./itinerary-mora-orsa.json');

module.exports = function (lambda) {

  describe('create itinerary with known agencies', () => {
    let error;
    let response;

    before(done => {
      // Sign the event data (Travis seems to have problems repeating the signatures)
      const newEvent = _.cloneDeep(event);
      delete newEvent.itinerary.signature;
      newEvent.itinerary.signature = utils.sign(newEvent.itinerary, process.env.MAAS_SIGNING_SECRET);

      wrap(lambda).run(newEvent, (_error, _response) => {
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

    xit('should trigger a valid response', () => {
      return validator.validate(schema, response)
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

    xit('should trigger a valid response', () => {
      return validator.validate(schema, response)
        .then(validationError => {
          expect(validationError).to.be.null;
        });
    });
  });
};
