'use strict';

const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models/index');
const Database = models.Database;
const Itinerary = require('../../lib/business-objects/Itinerary');
const Promise = require('bluebird');

function formatResponse(itinerary) {
  return Promise.resolve({
    itinerary: utils.removeNulls(itinerary),
    maas: {},
  });
}

module.exports.respond = function (event, callback) {
  const legErrors = [];

  return Database.init()
    .then(() => utils.validateSignatures(event.itinerary))
    .then(signedItinerary => utils.without(signedItinerary, ['signature']))
    .then(unsignedItinerary => Itinerary.create(unsignedItinerary, event.identityId))
    .then(itinerary => itinerary.pay())
    .then(itinerary => {
      // Itinerary does not offer reserve itself. Legs must be handled individually.
      // Leg reserving will be handled later by workflow engine. Workflow may, for example,
      // decide to reserve individual log (booking) in later.
      const legReserves = itinerary.legs.map(leg => {
        return leg.reserve().reflect();
      });
      return Promise.all(legReserves)
        .each(inspection => {
          if (!inspection.isFulfilled()) {
            legErrors.push(inspection.reason());
          }
        })
        .then(() => {
          if (legErrors.length > 0) {
            console.warn('Errors while reserving legs; cancelling itinerary...', legErrors);
            return itinerary.cancel();
          }
          return itinerary.activate(); // TODO: Do not activate after UI supports PAID state itineraries
        });
    })
    .then(itinerary => {
      if (itinerary.state === 'CANCELLED' || itinerary.state === 'CANCELLED_WITH_ERRORS') {
        return Promise.reject(new MaaSError(`Failed to reserve legs: ${legErrors}`, 400));
      }
      return Promise.resolve(itinerary);
    })
    .then(itinerary => formatResponse(itinerary.toObject()))
    .then(itinerary => {
      Database.cleanup()
        .then(() => callback(null, itinerary));
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });

};
