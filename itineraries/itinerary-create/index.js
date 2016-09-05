'use strict';

const Promise = require('bluebird');
const utils = require('../../lib/utils');
const maasOperation = require('../../lib/maas-operation/index');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models/index');
const TSPFactory = require('../../lib/tsp/TransportServiceAdapterFactory');
const stateMachine = require('../../lib/states/index').StateMachine;
const Database = models.Database;
const Trip = require('../../lib/trip');

/**
 * Parse itinerary to merge-ready database format
 * @param {object} itinerary
 */
function parseDatabaseFormat(itinerary) {
  function removeAllSignature(itinerary) {
    delete itinerary.signature;
    itinerary.legs.forEach(leg => {
      delete leg.signature;
    });
    return itinerary;
  }

  return removeAllSignature(itinerary);
}

/**
 * Checks if the leg is bookable or not
 *
 * @param {object} leg a leg to investigate
 * @return {boolean} true if the leg is bookable, false otherwise
 */
function isBookableLeg(leg) {
  switch (leg.mode) {
    // Erraneous data
    case 'undefined':
      throw new Error(`No mode available for leg ${JSON.stringify(leg, null, 2)}`);
    // Manual modes, no TSP needed
    case 'WAIT':
    case 'TRANSFER':
    case 'WALK':
      return false;
    // All the rest (MaaS should provide a ride)
    default:
      return true;
  }
}

/**
 * Change booking state and log the state change
 *
 * @param {object} booking
 * @param {string} state
 * @return {Promise -> undefined}
 */
function changeBookingState(booking, state) {
  const oldState = booking.state || 'START';
  return stateMachine.changeState('Booking', booking.id, oldState, state)
    .then(valid => {
      booking.state = state;
      return booking;
    });
}

/**
 * Change leg state and log the state change
 *
 * @param {object} leg
 * @param {string} state
 * @return {Promise -> undefined}
 */
function changeLegState(leg, state) {
  const oldState = leg.state || 'START';
  return stateMachine.changeState('Leg', leg.id, oldState, state)
    .then(valid => {
      leg.state = state;
      return leg;
    });
}

/**
 * Change itinerary state
 *
 * @param {object} itinerary
 * @param {string} state
 * @return {object} itinerary
 */
function changeItineraryState(itinerary, state) {
  const oldState = itinerary.state || 'START';

  return stateMachine.changeState('Itinerary', itinerary.id, oldState, state)
    .then(valid => {
      itinerary.state = state;
      return itinerary;
    });
}

/**
 * Create Id for the itinenaray and each of the leg within
 *
 * @param {object} itinerary - without id
 * @return {object} itinenery - without id
 */
function annotateIdentifiers(itinerary) {
  // Assign fresh identifiers for the itinerary and legs
  itinerary.id = utils.createId();
  itinerary.legs.forEach(leg => {
    leg.id = utils.createId();
  });

  return Promise.resolve(itinerary);
}

/**
 * Save itinerary on DB
 *
 * @param {itinerary} itinerary
 * @return {object} postgres response
 */
function saveItinerary(itinerary) {
  return models.Itinerary
    .query()
    .insertWithRelated(itinerary)
    .then(() => itinerary);
}

/**
 * Format itinerary before returning
 *
 * @param {object} itinerary
 * @return {object} itinerary
 */
function wrapToEnvelope(itinerary) {

  // Hide tspIds from user returned leg
  const copy = utils.cloneDeep(itinerary);
  copy.legs.forEach(leg => {
    if (leg.booking && leg.booking.tspId) {
      delete leg.tspId;
    }
  });

  return {
    itinerary: copy,
  };
}

function createAndAppendBookings(itinerary, profile) {
  function appendOneBooking(leg, tsp) {
    const reservation = {
      id: utils.createId(),
      leg: utils.cloneDeep(leg),
      customer: {
        identityId: profile.identityId,
        title: profile.title || 'mr',
        firstName: profile.firstName || 'John',
        lastName: profile.lastName || 'Doe',
        phone: profile.phone,
        email: profile.email || `maasuser-${profile.phone}@maas.fi`,
      },
      meta: {},
    };
    console.info(`Create booking '${reservation.id}' for leg '${leg.id}'`);

    // Update the booking state to PENDING to paind and finally to RESERVED
    // upon succesful booking. Toggle the booking states accordingly
    return changeBookingState(reservation, 'PENDING')
      .then(() => changeBookingState(reservation, 'PAID'))
      .then(() => tsp.reserve(reservation))
      .then(response => {
        const reservedBooking = utils.merge(reservation, response);
        console.info(`Created booking ${reservedBooking.id}, agencyId ${leg.agencyId}.`);
        leg.booking = reservedBooking;
        return changeBookingState(reservedBooking, 'RESERVED');
      }, error => {
        console.warn(`Booking failed for agency ${reservation.id}, agencyId ${leg.agencyId}`);
        console.warn(error);
        leg.booking = reservation;
        return changeBookingState(reservation, 'REJECTED');
      })
      .then(() => leg);
  }

  function cancelOneBooking(leg, tsp) {
    const booking = leg.booking;
    console.info(`Cancel booking '${leg.booking.id}' for leg '${leg.id}'`);

    // In case there's no nested booking, or the booking is already cancelled
    // or rejected, don't do a thing
    if (!booking || booking.state === 'CANCELLED') {
      return changeLegState(leg, 'CANCELLED');
    }

    if (booking.state === 'REJECTED') {
      return changeLegState(leg, 'CANCELLED_WITH_ERRORS');
    }

    // Then cancel the booking itself
    return tsp.cancel(booking.tspId)
      .then(() => {
        console.info(`Cancelled booking ${booking.id}, agencyId ${leg.agencyId}.`);
        return changeBookingState(leg.booking, 'CANCELLED');
      }, error => {
        console.warn(`Could not cancel booking ${booking.id} for leg ${leg.id}, cancel manually`);
      })
      .then(() => leg);
  }

  // The main function that iterates the leg and tries to book each
  return Promise.each(itinerary.legs, leg => {

    // Automatically accept all the legs that we cannot create bookings for
    if (!isBookableLeg(leg)) {
      return changeLegState(leg, 'PLANNED');
    }

    // Create the bookings for legs that we potentially can book
    return TSPFactory.createFromAgencyId(leg.agencyId)
        .then(
          tsp => appendOneBooking(leg, tsp),
          error => console.info(`Skipping leg '${leg.id}', no adapter for agencyId '${leg.agencyId}'.`)
        )
        .then(() => changeLegState(leg, 'PLANNED'));
  })
    .then(() => {
      // Iterate through the legs. In case all succeeded, return the itinerary.
      // In case of failure, cancel all the reserved bookings
      const hasFailures = itinerary.legs.some(leg => (leg.booking && leg.booking.state === 'REJECTED'));
      if (!hasFailures) {
        return Promise.resolve(itinerary);
      }

      // Cancel everything
      return Promise.each(itinerary.legs, leg => {
        if (!leg.booking) {
          return changeLegState(leg, 'CANCELLED')
            .then(() => leg);
        }

        return TSPFactory.createFromAgencyId(leg.agencyId)
          .then(
            tsp => {
              return cancelOneBooking(leg, tsp)
                .catch(() => changeLegState(leg, 'CANCELLED_WITH_ERRORS'))
                .then(() => changeLegState(leg, 'CANCELLED'));
            },
            error => {
              console.info(`Skipping booking creation for leg '${leg.id}', no adapter for agencyId '${leg.agencyId}'.`);
              return changeLegState(leg, 'CANCELLED');
            }
          )
          .catch(error => {
            // FIXME We should have better means for ensuring cancelOneBooking
            console.warn(`Could not cancel some of the bookings: ${error.message}`);
            console.warn(error.stack);
          });
      });
    })
    .then(() => {
      return itinerary;
    });
}

function bookItinerary(event) {
  let cachedProfile;
  let oldBalance;
  let annotatedItinerary;

  return annotateIdentifiers(event.itinerary)
    .then(_annotatedItinerary => {
      _annotatedItinerary.identityId = event.identityId;
      annotatedItinerary = _annotatedItinerary;
      return maasOperation.fetchCustomerProfile(event.identityId);
    })
    .then(_profile => {
      cachedProfile = _profile;
      oldBalance = _profile.balance;
      return changeItineraryState(annotatedItinerary, 'PLANNED');
    })
    .then(plannedItinerary => maasOperation.computeBalance(plannedItinerary.fare.points, cachedProfile))
    .then(newBalance => maasOperation.updateBalance(event.identityId, newBalance))
    .then(response => changeItineraryState(annotatedItinerary, 'PAID'))
    .then(paidItinerary => createAndAppendBookings(paidItinerary, cachedProfile))
    .then(bookedItinerary => {
      console.info(`Created itinerary '${bookedItinerary.id}' with ${bookedItinerary.legs.length} legs.`);
      return saveItinerary(parseDatabaseFormat(bookedItinerary));
    })
    .then(savedItinerary => Trip.startWithItinerary(savedItinerary))
    .then(tripItinerary => wrapToEnvelope(tripItinerary))
    .catch(error => {
      return maasOperation.updateBalance(event.identityId, oldBalance)
        .return(Promise.reject(error));
    });
}

module.exports.respond = function (event, callback) {
  return Promise.all([
    Database.init(),
    utils.validateSignatures(event.itinerary),
  ])
  .then((_knex, _itinerary) => bookItinerary(event))
  .then(response => {
    Database.cleanup()
      .then(() => callback(null, response));
  })
  .catch(_error => {
    console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

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
