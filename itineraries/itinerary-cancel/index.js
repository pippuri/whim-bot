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

  const transaction = new Transaction(event.identityId);

  return validateInput(event)
    .then(() => models.Database.init())
    .then(() => Itinerary.retrieve(event.itineraryId))
    .then(itinerary => itinerary.validateOwnership(event.identityId))
    .then(itinerary => {
      transaction.meta(models.Itinerary.tableName, itinerary.id);
      return transaction.start()
        .then(() => transaction.bind(models.Itinerary))
        .then(() => Promise.resolve(itinerary));
    })
    .then(itinerary => itinerary.cancel(transaction))
    .then(itinerary => Trip.cancelWithItinerary(itinerary))
    .then(itineraryInstance => {
      const itinerary = itineraryInstance.toObject();
      const message = `Cancelled a trip from ${itineraryInstance.fromName()} to ${itineraryInstance.toName()}`;
      // At this points do not know how many points are actually returned, soooooo
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
