'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const stateMachine = require('../../lib/states/index').StateMachine;
const TSPFactory = require('../../lib/tsp/TransportServiceAdapterFactory');
const utils = require('../../lib/utils');
const Database = models.Database;

/**
 * Validate event input
 *
 * @param  {object} event with a identityId and bookingId
 * @return {Promise} undefined in case of success, MaaSError otherwise
 */
function validateInput(event) {
  // Require identityId and phone in input user profile
  if (!event.identityId || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId', 400));
  }

  if (typeof event.bookingId !== 'string') {
    return Promise.reject(new MaaSError('Missing or invalid booking id', 400));
  }

  return Promise.resolve();
}

/**
 * Validates the state change to cancelled for a given booking
 *
 * @param {object} booking the booking to validate the state change against
 * @return {Promise} resolved to undefined if valid, reject with MaaSError 400 otherwise
 */
function validateStateChanges(booking) {
  if (!stateMachine.isStateValid('Booking', booking.state, 'CANCELLED')) {
    const message = `Booking ${booking.id}: State transition from ${booking.state} to CANCELLED not permitted.`;
    return Promise.reject(new MaaSError(message, 400));
  }

  return Promise.resolve(booking);
}

/**
 * Cancels a booking; delegates to TSP, and updates the state in the DB.
 * In case of success, resolves with the new state; in case of failure, rejects with an error.
 *
 * @return an Promise that resolves into an array of the states of bookings { id, state }
 */
function cancelBooking(booking) {
  console.info(`Cancel booking ${booking.id}, agencyId ${booking.leg.agencyId}`);

  return TSPFactory.createFromAgencyId(booking.leg.agencyId)
    .then(tsp => tsp.cancel(booking.tspId))
    .catch(error => {
      console.warn(`Booking ${booking.id}, agencyId ${booking.leg.agencyId}, cancellation failed, ${error.message}, ${JSON.stringify(error)}`);
      console.warn(error.stack);
      return Promise.reject(error);
    })
    .then(() => {
      console.info(`Booking ${booking.id}, agencyId ${booking.leg.agencyId} cancelled from the TSP side`);

      return Promise.all([
        models.Booking.query()
          .patch({ state: 'CANCELLED' })
          .where('id', booking.id),
        stateMachine.changeState('Booking', booking.id, booking.state, 'CANCELLED'),
      ]);
    })
    .spread((updateCount, _) => {
      console.info(`Booking ${booking.id}, agencyId ${booking.leg.agencyId}, state updated.`);
      if (updateCount === 0) {
        return Promise.reject(new MaaSError(`Booking ${booking.id} failed to update: Not found`, 404));
      }

      // Clone the booking, with the state cancelled
      const newBooking = utils.cloneDeep(booking);
      newBooking.state = 'CANCELLED';

      return Promise.resolve(newBooking);
    });
}
/**
 * Fetches a booking with given bookingId and identityId
 *
 * @param {string} bookingId The id of the booking
 * @param {string} identityId The identity of the calling user
 * @return {Promise} that resolves to the matching booking, or reject with MaaSError
 */
function fetchBooking(bookingId, identityId) {
  // Get the old state
  return models.Booking.query()
    .findById(bookingId)
    .then(booking => {
      // Handle not found
      if (typeof booking === typeof undefined) {
        return Promise.reject(new MaaSError(`No item found with itineraryId ${bookingId}`, 404));
      }

      // Handle item not user's itinerary
      if (booking.customer.identityId !== identityId) {
        return Promise.reject(new MaaSError(`Itinerary ${bookingId} not owned by the user`, 403));
      }

      return Promise.resolve(booking);
    });
}

/**
 * Formats the response by removing JSON nulls
 *
 * @param {object} booking The unformatted response object
 * @return {object} A valid MaaS Response nesting the object & meta
 */
function formatResponse(booking) {
  const trimmed = utils.removeNulls(booking);

  return Promise.resolve({
    booking: trimmed,
    maas: {},
  });
}

module.exports.respond = (event, callback) => {

  return Database.init()
    .then(() => validateInput(event))
    .then(() => fetchBooking(event.bookingId, event.identityId))
    .then(booking => validateStateChanges(booking))
    .then(booking => cancelBooking(booking))
    .then(formatResponse)
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn(`This event caused error: ${JSON.stringify(event, null, 2)}`);

      // Uncaught, unexpected error
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
