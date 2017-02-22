'use strict';

const Booking = require('../../lib/business-objects/Booking');
const Database = require('../../lib/models/Database');
const Itinerary = require('../../lib/business-objects/Itinerary');
const MaaSError = require('../../lib/errors/MaaSError');
const Transaction = require('../../lib/business-objects/Transaction');
const TripEngine = require('../../lib/trip');
const utils = require('../../lib/utils');

/**
 * Validate event input
 *
 * @param  {object} event
 * @return {Promise -> undefined}
 */
function validateInput(event) {
  if (typeof event.identityId !== 'string' || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId', 400));
  }

  if (typeof event.bookingId !== 'string') {
    return Promise.reject(new MaaSError('Missing or invalid booking id', 400));
  }

  const refresh = event.refresh;
  if (refresh !== 'true' && refresh !== 'false' && refresh !== '' && typeof refresh !== 'undefined') {
    return Promise.reject(new MaaSError(`Invalid value for refresh: ${refresh}, should be 'true' or 'false'`, 400));
  }

  return Promise.resolve();
}

/**
 * Formats the response by removing JSON nulls
 *
 * @param {object} booking The unformatted response object
 * @return {object} A valid MaaS Response nesting the object & meta
 */
function formatResponse(booking) {
  const trimmed = utils.sanitize(booking);

  return {
    booking: trimmed,
    maas: {},
  };
}

module.exports.respond = (event, callback) => {

  return Database.init()
    .then(() => validateInput(event))
    .then(() => {
      if (event.refresh && event.refresh === 'true' || event.refresh === true) {
        const transaction = new Transaction(event.identityId);
        let stateBefore;

        // Commit the transaction but skip writing to transaction log
        // this does not have anything to do with value, but we want to prevent
        // concurrent writes to bookings.
        return transaction.start()
        .then(() => Booking.retrieve(event.bookingId, transaction))
        .then(booking => booking.validateOwnership(event.identityId))
        .then(booking => {
          stateBefore = booking.state;
          return Promise.resolve(booking);
        })
        .then(booking => booking.refresh(transaction))
        .then(booking => {
          // If Booking state has changed, and it is part of Itinerary or Itineraries,
          // signal corresponging TripEngine flow(s)
          if (booking.state !== stateBefore) {
            return Itinerary.query(booking.identityId, null, null, [], booking.id)
              .then(itineraries => Promise.all(itineraries.map(itinerary => {
                return TripEngine.checkWithItinerary(itinerary);
              })))
              .then(() => Promise.resolve(booking));
          }
          return Promise.resolve(booking);
        })
        .then(booking => {
          return transaction.commit().then(() => Promise.resolve(booking));
        })
        .catch(error => {
          return transaction.rollback()
            .then(() => Promise.reject(error));
        });
      }

      // No refreshing, no transaction needed
      return Booking.retrieve(event.bookingId)
        .then(booking => booking.validateOwnership(event.identityId));
    })
    .then(
      booking => Database.cleanup().then(() => formatResponse(booking.toObject())),
      error => Database.cleanup().then(() => Promise.reject(error))
    )
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      // Uncaught, unexpected error
      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
