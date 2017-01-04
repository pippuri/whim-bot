'use strict';

const Itinerary = require('../../lib/business-objects/Itinerary');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models/index');
const Promise = require('bluebird');
const signatures = require('../../lib/signatures');
const Transaction = require('../../lib/business-objects/Transaction');
const TripEngine = require('../../lib/trip');
const utils = require('../../lib/utils');

function formatResponse(itinerary) {
  return Promise.resolve({
    itinerary: utils.sanitize(itinerary),
    maas: {},
  });
}

module.exports.respond = function (event, callback) {
  const transaction = new Transaction(event.identityId);

  return signatures.validateSignatures(event.itinerary)
    .then(signedItinerary => utils.without(signedItinerary, ['signature']))
    .then(unsignedItinerary => models.Database.init().then(() => Promise.resolve(unsignedItinerary)))
    .then(unsignedItinerary => {
      return transaction.start()
        .then(() => Itinerary.create(unsignedItinerary, event.identityId, transaction))
        .then(newItinerary => {
          transaction.meta(models.Itinerary.tableName, newItinerary.id);
          return Promise.resolve(newItinerary);
        });
    })
    .then(newItinerary => newItinerary.pay(transaction))
    // Juha's block of code, reinsert right here in case of emergency http://codepen.io/blackevil245/pen/eBvoBX
    .then(itinerary => TripEngine.startWithItinerary(itinerary))
    .then(itineraryInstance => {
      // Response is a Itinerary class instance
      const itinerary = itineraryInstance.toObject();
      // Prevent faulty negative point in itinerary fare as all itineraries must cost more or equal to 0
      if (itinerary.fare && itinerary.fare.points < 0) {
        return transaction.rollback()
          .then(() => Promise.reject(new MaaSError('Faulty new itinerary, fare is smaller than 0', 500)));
      }

      const message = `Reserved a trip from ${itineraryInstance.fromName()} to ${itineraryInstance.toName()}`;
      return transaction.commit(message)
        .then(() => Promise.resolve(itinerary));
    })
    .then(itinerary => formatResponse(itinerary))
    .then(response => {
      models.Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      return transaction.rollback()
        .then(() => models.Database.cleanup())
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
