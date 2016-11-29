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
  const transaction = new Transaction();

  return signatures.validateSignatures(event.itinerary)
    .then(signedItinerary => utils.without(signedItinerary, ['signature']))
    .then(unsignedItinerary => models.Database.init().then(() => Promise.resolve(unsignedItinerary)))
    .then(unsignedItinerary => {
      return transaction.start()
        .then(() => transaction.bind(models.Itinerary))
        .then(() => Itinerary.create(unsignedItinerary, event.identityId, transaction.self))
        .then(newItinerary => {
          return transaction.meta(models.Itinerary.tableName, newItinerary.id)
            .then(() => Promise.resolve(newItinerary));
        });
    })
    .then(newItinerary => newItinerary.pay(transaction.self))
    // Juha's block of code, reinsert right here in case of emergency http://codepen.io/blackevil245/pen/eBvoBX
    .then(itinerary => TripEngine.startWithItinerary(itinerary))
    .then(response => {
      // Response is a Itinerary class instance
      const itinerary = response.toObject();

      // Prevent faulty negative point in itinerary fare as all itineraries must cost more or equal to 0
      if (itinerary.fare && itinerary.fare.points < 0) {
        return transaction.rollback()
          .then(() => Promise.reject(new MaaSError('Faulty new itinerary, fare is smaller than 0', 500)));
      }

      const firstLeg = itinerary.legs[0];
      const lastLeg = itinerary.legs[itinerary.legs.length - 1];

      const fromName = firstLeg.from.name ? firstLeg.from.name : `${firstLeg.from.lat},${firstLeg.from.lon}`;
      const toName = lastLeg.to.name ? lastLeg.to.name : `${lastLeg.to.lat},${lastLeg.to.lon}`;

      const message = `Reserved a trip from ${fromName} to ${toName}`;
      return transaction.commit(message, event.identityId, -1 * itinerary.fare.points)
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
