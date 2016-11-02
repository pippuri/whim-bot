'use strict';

const Itinerary = require('../../lib/business-objects/Itinerary');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models/index');
const Promise = require('bluebird');
const signatures = require('../../lib/signatures');
const TripEngine = require('../../lib/trip');
const utils = require('../../lib/utils');

const Database = models.Database;

function formatResponse(itinerary) {
  return Promise.resolve({
    itinerary: utils.sanitize(itinerary),
    maas: {},
  });
}

module.exports.respond = function (event, callback) {
  let trx;
//  const legErrors = [];

  return Database.init()
    .then(() => signatures.validateSignatures(event.itinerary))
    .then(signedItinerary => utils.without(signedItinerary, ['signature']))
    .then(unsignedItinerary => Itinerary.startTransaction()
      .then(transaction => {
        trx = transaction;
        return Promise.resolve();
      })
      .then(() => Itinerary.create(unsignedItinerary, event.identityId, trx)))
    .then(itinerary => itinerary.pay(trx))
/*
    // Testing bold version where all bookings are handled in TripEngine side. If finding
    // problems, reverting back that legs are activated (booking happens) already here.

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
            return itinerary.cancel(trx);
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
    .then(itinerary => TripEngine.startWithItinerary(itinerary)) // Start workflow execution
    .then(itinerary => trx.commit()
      .then(() => Promise.resolve(itinerary)))
    .then(itinerary => formatResponse(itinerary.toObject()))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      const rollback = trx ? trx.rollback() : Promise.resolve();
      return rollback
        .then(() => Database.cleanup())
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });

};
