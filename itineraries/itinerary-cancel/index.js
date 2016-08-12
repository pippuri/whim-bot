'use strict';

const Promise = require('bluebird');
const models = require('../../lib/models');
const MaaSError = require('../../lib/errors/MaaSError');
const tsp = require('../../lib/tsp/index');
const stateMachine = require('../../lib/states').StateMachine;
const utils = require('../../lib/utils');
const Database = models.Database;

/**
 * Filters away the legs that don't need to be act on.
 * Legs that don't need to be act on are the ones in states
 * 'FINSHED', 'CANCELLED', or 'ABANDONED'
 *
 * @param legs Array containing all legs that are to be filtered
 * @return Array containing legs that can be cancelled
 */
function filterCancellableLegs(legs) {
  return legs.filter(leg => {
    switch (leg.state) {
      case 'CANCELLED':
      case 'FINISHED':
      case 'ABANDONED':
        return false;
      default:
        return true;
    }
  });
}

function validateStateChanges(itinerary) {
  // Itinerary
  if (!stateMachine.isStateValid('Itinerary', itinerary.state, 'CANCELLED')) {
    const message = `Itinerary ${itinerary.id}: State transition from ${itinerary.state} to CANCELLED not permitted.`;
    return Promise.reject(new MaaSError(message, 400));
  }

  // Legs
  const cancellableLegs = filterCancellableLegs(itinerary.legs);
  for (let i = 0; i < cancellableLegs.length; i++) {
    const leg = itinerary.legs[i];
    const booking = leg.booking;

    if (!stateMachine.isStateValid('Leg', leg.state, 'CANCELLED')) {
      const message = `Itinerary ${itinerary.id}, Leg ${leg.id}: State transition from ${leg.state} to CANCELLED not permitted`;
      return Promise.reject(new MaaSError(message, 400));
    }

    // Not all the legs have a booking
    if (typeof booking === typeof undefined || booking === null) {
      continue;
    }

    // Nested booking
    if (!stateMachine.isStateValid('Booking', booking.state, 'CANCELLED')) {
      const message = `Itinerary ${itinerary.id}, Leg ${leg.id}, Booking ${booking.id}: State transition from ${leg.state} to CANCELLED not permitted`;
      return Promise.reject(new MaaSError(message, 400));
    }
  }

  return Promise.resolve(itinerary);
}

/**
 * Cancels a booking; performs a state check, delegates to TSP, and updates the state in the DB.
 * In case of success, resolves with the new state; in case of failure, rejects with an error.
 *
 * @return an Promise that resolves into an array of the states of bookings { id, state }
 */
function cancelBooking(booking) {
  console.info(`Cancel booking ${booking.id}, agencyId ${booking.leg.agencyId}`);

  return tsp.cancelBooking(booking)
    .catch(error => {
      console.warn(`Booking ${booking.id}, agencyId ${booking.leg.agencyId}, cancellation failed, ${error.message}, ${JSON.stringify(error)}`);
      console.warn(error.stack);
      return Promise.reject(error);
    })
    .then(() => {
      console.info(`Booking ${booking.id}, agencyId ${booking.leg.agencyId} cancelled from the TSP side`);

      return [
        models.Booking.query()
          .patch({ state: 'CANCELLED' })
          .where('id', booking.id),
        stateMachine.changeState('Booking', booking.id, booking.state, 'CANCELLED'),
      ];
    })
    .spread((updateCount, _) => {
      console.info(`Booking ${booking.id}, agencyId ${booking.leg.agencyId}, state updated.`);
      if (updateCount === 0) {
        return Promise.reject(new MaaSError(`Booking ${booking.id} failed to update: Not found`, 404));
      }

      return Promise.resolve('CANCELLED');
    });
}

/**
 * Tries to cancel an individual leg. Performs a state check, delegates to
 * booking cancellation, and updates the state in the DB.
 *
 * In case of failing to cancel the nested booking, resets the leg state to CANCELLED_WITH_ERRORS.
 *
 * @return a Promise, resolving to 'CANCELLED' or 'CANCELLED_WITH_ERRORS', or rejected in case of failed update
 */
function cancelLeg(leg) {
  console.info(`Cancel leg ${leg.id}`);

  return new Promise((resolve, reject) => {
    const booking = leg.booking;

    // In case of missing booking, resolve with the same value that a succesful booking would
    if (typeof booking === typeof undefined || booking === null) {
      resolve('CANCELLED');
    }

    // Cancel the booking, but recover from the errors.
    cancelBooking(booking)
      .then(success => {
        console.info(`Booking ${booking.id}, agencyId ${booking.leg.agencyId} cancelled`);
        resolve('CANCELLED');
      }, error => {
        console.warn(`Booking ${booking.id}, agencyId ${booking.leg.agencyId} cancellation failed`);
        console.warn(error.message, error.stack);
        resolve('CANCELLED_WITH_ERRORS');
      });
  })
  .then(newState => {
    // Update the leg
    return stateMachine.changeState('Leg', leg.id, leg.state, newState)
      .then(() => {
        return models.Leg.query()
          .patch({ state: newState })
          .where('id', leg.id);
      })
      .then(() => Promise.resolve(newState));
  });
}

/**
 * Tries to cancel an itinerary. Performs state check, delegates to individual
 * leg cancaellations, and updates the state in the DB.
 *
 * In case of failing to cancel one or more of the children, sets its state to
 * CANCELLED_WITH_ERRORS.
 */
function cancelItinerary(itinerary) {
  console.info(`Cancel itinerary ${itinerary.id}`);

  // Check which legs need to be cancelled (finished ones don't)
  const cancellableLegs = filterCancellableLegs(itinerary.legs);

  // First cancel the legs, then investigate their states to determine whether
  // to resolve with cancelled with errors or normal cancel
  return Promise.map(cancellableLegs, leg => cancelLeg(leg))
    .then(newStates => {
      const hasErrors = newStates.some(state => state !== 'CANCELLED');
      const newState = hasErrors ? 'CANCELLED_WITH_ERRORS' : 'CANCELLED';

      return [
        newState,
        stateMachine.changeState('Itinerary', itinerary.id, itinerary.state, newState),
      ];
    })
    .spread((newState, _) => {
      return models.Itinerary
        .query()
        .patchAndFetchById(itinerary.id, { state: 'CANCELLED' })
        .eager('[legs, legs.booking]');
    });
}

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

function fetchItinerary(itineraryId, identityId) {
  // Get the old state
  return models.Itinerary.query()
    .findById(itineraryId)
    .eager('[legs, legs.booking]')
    .then(itinerary => {
      // Handle not found
      if (typeof itinerary === typeof undefined) {
        return Promise.reject(new MaaSError(`No item found with itineraryId ${event.itineraryId}`, 404));
      }

      // Handle item not user's itinerary
      if (itinerary.identityId !== identityId) {
        return Promise.reject(new MaaSError(`Itinerary ${event.itineraryId} not owned by the user`, 403));
      }

      return Promise.resolve(itinerary);
    });
}

function formatResponse(itinerary) {
  return Promise.resolve({
    itinerary: utils.removeNulls(itinerary),
    maas: {},
  });
}

module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => validateInput(event))
    .then(() => fetchItinerary(event.itineraryId, event.identityId))
    .then(itinerary => validateStateChanges(itinerary))
    .then(itinerary => cancelItinerary(itinerary))
    .then(formatResponse)
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

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
