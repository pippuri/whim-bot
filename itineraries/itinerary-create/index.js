'use strict';

const Database = require('../../lib/models/Database');
const Itinerary = require('../../lib/business-objects/Itinerary');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models/index');
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
  return models.Database.init()
    .then(() => signatures.validateSignatures(event.itinerary))
    .then(signedItinerary => utils.without(signedItinerary, ['signature']))
    .then(unsignedItinerary => {
      const transaction = new Transaction(event.identityId);
      return transaction.start()
        .then(() => Itinerary.create(unsignedItinerary, event.identityId, transaction))
        .then(newItinerary => newItinerary.pay(transaction))
        // Juha's block of code, reinsert right here in case of emergency http://codepen.io/blackevil245/pen/eBvoBX
        .then(itinerary => TripEngine.startWithItinerary(itinerary))
        .then(itineraryBO => {
          // Response is a Itinerary business object
          const itinerary = itineraryBO.toObject();

          // Prevent faulty negative point in itinerary fare
          if (itinerary.fare && itinerary.fare.points < 0) {
            const message = 'Faulty new itinerary, fare is smaller than 0';
            return Promise.reject(new MaaSError(message, 500));
          }

          return itineraryBO;
        })
        .then(itineraryBO => {
          const message = `Reserved a trip from ${itineraryBO.fromName()} to ${itineraryBO.toName()}`;
          return transaction.commit(message).then(() => itineraryBO.toObject());
        })
        .catch(error => transaction.rollback().then(() => Promise.reject(error)));
    })
    .then(
      itinerary => Database.cleanup().then(() => formatResponse(itinerary)),
      error => Database.cleanup().then(() => Promise.reject(error))
    )
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
