'use strict';

const _ = require('lodash');
const wrap = require('lambda-wrapper').wrap;
const utils = require('../../../lib/utils');
const expect = require('chai').expect;
const models = require('../../../lib/models');
const Promise = require('bluebird');
const creationEvent = require('../../../itineraries/itinerary-create/event.json');

module.exports = function (createLambda, setActiveLambda) {

  describe('activate an itinerary, created by itinerary create', () => {
    let error;
    let response;

    before(done => {
      // Sign the event data (Travis seems to have problems repeating the signatures)
      const newEvent = _.cloneDeep(creationEvent);
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

        const setActiveEvent = {
          identityId: newEvent.identityId,
          itinerary: {
            id: _response.itinerary.id,
            timestamp: Date.now(),
            legId: _response.itinerary.legs[0].id
          }
        };

        wrap(setActiveLambda).run(setActiveEvent, (_error, _response) => {
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
  });
};
