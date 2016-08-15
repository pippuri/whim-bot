'use strict';

//const _ = require('lodash');
const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const tsp = require('../../lib/tsp');
const stateMachine = require('../../lib/states/index').StateMachine;
const utils = require('../../lib/utils');
const Database = models.Database;

/**
 * Validate event input
 *
 * @param  {object} event
 * @return {Promise -> undefined}
 */
function validateInput(event) {
  // Require identityId and phone in input user profile
  if (!event.identityId || event.identityId === '') {
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
 * Fetches an existing booking and validates the identityId owns it
 *
 * @param bookingId The id of the booking
 * @param identityId The id of the user that fetches the booking
 * @return Promise that resolves to a booking, or rejects with MaaSError
 */
function fetchBooking(bookingId, identityId) {
  //console.log(`Fetch booking ${bookingId}`);

  return models.Booking.query()
    .findById(bookingId)
    .then(booking => {
      if (!booking) {
        const message = `No booking found with bookingId '${bookingId}'`;
        return Promise.reject(new MaaSError(message, 404));
      }

      if (booking.customer.identityId !== identityId) {
        return Promise.reject(new MaaSError(`Booking ${bookingId} not owned by the user`, 403));
      }

      return Promise.resolve(booking);
    });
}

/**
 * Compares and the bookign data with delta, and merges the delta if there are
 * no improper changes, such as illegal state or such.
 */
function validateAndMergeChanges(booking, delta) {
  const promiseQueue = [];

  // Don't accept invalid deltas
  if (typeof delta.state === 'undefined') {
    promiseQueue.push(Promise.reject('TSP returned an undefined \'state\''));
  }

  // Don't update state if there isn't new one
  if (booking.state !== delta.state) {
    promiseQueue.push(stateMachine.changeState('Booking', booking.id, booking.state, delta.state));
  }

  return Promise.all(promiseQueue)
    .then(() => {
      // Merge the properties that can be merged
      const agencyId = booking.leg.agencyId;
      ['terms', 'token', 'meta', 'leg'].forEach(key => {
        const value = delta[key];
        if (typeof value !== 'undefined') {
          booking[key] = delta[key];
        }
      });
      // FIXME We shouldn't need to juggle agencyId like this
      booking.leg.agencyId = agencyId;

      return booking;
    });
}

/**
 * Updates a booking in the database
 */
function updateDatabase(booking) {
  return models.Booking.query()
    .updateAndFetchById(booking.id, booking)
    .then(updatedBooking => {
      if (typeof updatedBooking === 'undefined') {
        const message = `Updating failed; booking ${booking.id} not found in the database`;
        return Promise.reject(new MaaSError(message, 500));
      }

      return updatedBooking;
    });
}

/**
 * Fetches the booking delta from TSP side; validates changes and merges them
 * into the existing booking.
 *
 * @param booking The booking to refresh the new data with (will be modified)
 * @return Promise resolved with the refreshed booking, or rejected with MaaSError
 */
function refreshBooking(booking) {
  console.info(`Refresh booking ${booking.id} for agencyId ${booking.leg.agencyId}`);
  return tsp.retrieveBooking(booking.tspId, booking.leg.agencyId)
    .then(delta => validateAndMergeChanges(booking, delta))
    .then(updateDatabase);
}

/**
 * Formats the response by removing JSON nulls
 */
function formatResponse(booking) {
  const trimmed = utils.removeNulls(booking);

  return Promise.resolve(trimmed);
}

module.exports.respond = (event, callback) => {
  return Promise.all([
    Database.init(),
    validateInput(event),
  ])
    .then(() => fetchBooking(event.bookingId, event.identityId))
    .then(booking => {
      if (Boolean(event.refresh)) {
        return refreshBooking(booking);
      }

      return booking;
    })
    .then(formatResponse)
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
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
