'use strict';

const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models/index');
const Database = models.Database;
//const Trip = require('../../lib/trip');
const Itinerary = require('../../lib/business-objects/Itinerary');
const Promise = require('bluebird');

function formatResponse(itinerary) {
  return Promise.resolve({
    itinerary: utils.removeNulls(itinerary),
    maas: {},
  });
}

module.exports.respond = function (event, callback) {

  return Database.init()
    .then(() => utils.validateSignatures(event.itinerary))        // Validate request signature
    .then(validItineraryData => Itinerary.create(validItineraryData, event.identityId))
    .then(itinerary => itinerary.pay())
    .then(itinerary => {
      // Itinerary does not offer reserve itself. Legs must be handled individually.
      // Leg reserving will be handled later by workflow engine. Workflow may, for example,
      // decide to reserve individual log (booking) in later.
      const legErrors = [];
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
            return itinerary.cancel();
          }
          return itinerary.activate();
        });
    })
    .then(itinerary => formatResponse(itinerary.toObject()))
    .then(itinerary => {
      Database.cleanup()
        .then(() => callback(null, itinerary));
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

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
