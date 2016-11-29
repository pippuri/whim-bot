'use strict';

const Promise = require('bluebird');
const models = require('../../lib/models');
const MaaSError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils');
const Trip = require('../../lib/trip');
const Itinerary = require('../../lib/business-objects/Itinerary');
const Transaction  = require('../../lib/business-objects/Transaction');

function validateInput(event) {
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId input', 401));
  }

  // TODO Stricter itineraryId validation
  if (!event.hasOwnProperty('itineraryId') || event.itineraryId === '') {
    return Promise.reject(new MaaSError('Missing or invalid itineraryId', 400));
  }

  return Promise.resolve(event);
}

function formatResponse(itinerary) {
  return Promise.resolve({
    itinerary: utils.sanitize(itinerary),
    maas: {},
  });
}

module.exports.respond = (event, callback) => {

  const transaction = new Transaction();

  return validateInput(event)
    .then(() => models.Database.init())
    .then(() => Itinerary.retrieve(event.itineraryId))
    .then(itinerary => itinerary.validateOwnership(event.identityId))
    .then(itinerary => {
      return transaction.start()
        .then(() => transaction.bind(models.Itinerary))
        .then(() => transaction.meta(models.Itinerary.tableName, itinerary.id))
        .then(() => Promise.resolve(itinerary));
    })
    .then(itinerary => itinerary.cancel(transaction.self))
    .then(itinerary => Trip.cancelWithItinerary(itinerary))
    .then(response => {
      const itinerary = response.toObject();
      const firstLeg = itinerary.legs[0];
      const lastLeg = itinerary.legs[itinerary.legs.length - 1];

      const fromName = firstLeg.from.name ? firstLeg.from.name : `${firstLeg.from.lat},${firstLeg.from.lon}`;
      const toName = lastLeg.to.name ? lastLeg.to.name : `${lastLeg.to.lat},${lastLeg.to.lon}`;

      const message = `Cancelled a trip from ${fromName} to ${toName}`;
      return transaction.commit(message, event.identityId, itinerary.fare.points)
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
