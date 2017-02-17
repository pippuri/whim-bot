'use strict';

const Database = require('../../lib/models/Database');
const Itinerary = require('../../lib/business-objects/Itinerary');
const MaaSError = require('../../lib/errors/MaaSError');
const Promise = require('bluebird');
const Transaction  = require('../../lib/business-objects/Transaction');
const Trip = require('../../lib/trip');
const utils = require('../../lib/utils');

function validateInput(event) {
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId input', 400));
  }

  // TODO Stricter itineraryId validation
  if (!event.hasOwnProperty('itineraryId') || event.itineraryId === '') {
    return Promise.reject(new MaaSError('Missing or invalid itineraryId', 400));
  }

  return Promise.resolve(event);
}

function formatResponse(itinerary) {
  return {
    itinerary: utils.sanitize(itinerary),
    debug: {},
  };
}

module.exports.respond = (event, callback) => {

  const transaction = new Transaction(event.identityId);

  return validateInput(event)
    .then(() => Database.init())
    .then(() => transaction.start())
    .then(() => Itinerary.retrieve(event.itineraryId))
    .then(itinerary => itinerary.validateOwnership(event.identityId))
    .then(itinerary => {
      return itinerary.cancel(transaction)
        .then(itinerary => Trip.cancelWithItinerary(itinerary))
        .then(itineraryBO => {
          const itinerary = itineraryBO.toObject();
          const message = `Cancelled a trip from ${itineraryBO.fromName()} to ${itineraryBO.toName()}`;
          // At this points do not know how many points are actually returned, soooooo
          return transaction.commit(message).then(() => itinerary);
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
