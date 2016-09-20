'use strict';

const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models/index');
const Database = models.Database;
const Trip = require('../../lib/trip');
const Itinerary = require('../../lib/business-objects/Itinerary');
const Promise = require('bluebird');

function formatResponse(itinerary) {
  return Promise.resolve({
    itinerary: utils.removeNulls(itinerary),
    maas: {},
  });
}

module.exports.respond = function (event, callback) {
//  const legErrors = [];

  return Database.init()
    .then(() => utils.validateSignatures(event.itinerary))
    .then(signedItinerary => utils.without(signedItinerary, ['signature']))
    .then(unsignedItinerary => Itinerary.create(unsignedItinerary, event.identityId))
    .then(itinerary => itinerary.pay())

/*
    .then(itinerary => {
      // Activate itinerary and legs rightaway. Later these are done by TripEngine
      // in the background.
      const legActivates = itinerary.legs.map(leg => {
        return leg.activate().reflect();
      });
      return Promise.all(legActivates)
        .each(inspection => {
          if (!inspection.isFulfilled()) {
            legErrors.push(inspection.reason());
          }
        })
        .then(() => {
          if (legErrors.length > 0) {
            console.warn('Errors while activating legs; cancelling itinerary...', legErrors);
            return itinerary.cancel();
          }
          return itinerary.activate();
        });
    })
    .then(itinerary => {
      if (itinerary.state === 'CANCELLED' || itinerary.state === 'CANCELLED_WITH_ERRORS') {
        return Promise.reject(new MaaSError(`Failed to reserve legs: ${legErrors}`, 400));
      }
      return Promise.resolve(itinerary);
    })
*/
    .then(itinerary => Trip.startWithItinerary(itinerary)) // Start workflow execution
    .then(itinerary => formatResponse(itinerary.toObject()))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
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
