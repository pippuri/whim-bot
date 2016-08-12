'use strict';

const Promise = require('bluebird');
const utils = require('../../lib/utils');
const maasOperation = require('../../lib/maas-operation/index');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models/index');
const tsp = require('../../lib/tsp/index');
const stateMachine = require('../../lib/states/index').StateMachine;
const Database = models.Database;

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
 * Remove unbookable leg out of the collection
 * @param {object array} legs - array of legs
 * @return {object array} legs - arary of bookable legs
 */
function filterBookableLegs(legs) {

  // Filter away the legs that do not need a TSP
  return legs.filter(leg => {
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
        if (tsp.containsAgency(leg.agencyId)) {
          return true;
        }

        console.warn(`Could not find a TSP for ${leg.agencyId}`);
        return false;
    }
  });
}

/**
 * Change booking state and log the state change
 * @param {object} booking
 * @param {string} state
 * @return {Promise -> undefined}
 */
function changeBookingState(booking, state) {
  const old_state = booking.state || 'START';
  booking.state = state;
  return stateMachine.changeState('Booking', booking.id || booking.bookingId, old_state, booking.state)
    .return(booking);
}

/**
 * Create Id for the itinenaray and each of the leg within
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
 * Change itinerary state
 * @param {object} itinerary
 * @param {string} state
 * @return {object} itinerary
 */
function annotateItineraryState(itinerary, state) {
  function annotateLegsState(itinerary, state) {
    const queue = [];
    itinerary.legs.forEach(leg => {
      // Starting state
      leg.state = leg.state || 'START';
      queue.push(stateMachine.changeState('Leg', leg.id, leg.state, state));
    });

    return Promise.all(queue)
     .then(response => {
       itinerary.legs.map(leg => {
         leg.state = state;
       });

       return itinerary;
     });
  }

  // Set itinerary state to starting state if no state exists
  itinerary.state = itinerary.state || 'START';

  return stateMachine.changeState('Itinerary', itinerary.id, itinerary.state, state)
    .then(newState => {
      itinerary.state = state;

      return annotateLegsState(itinerary, state);
    })
    .then(_itinerary => _itinerary);
}

/**
 * Save itinerary on DB
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
 * @param {object} itinerary
 * @return {object} itinerary
 */
function wrapToEnvelope(itinerary) {
  if (itinerary.legs &&  itinerary.legs.constructor === Array) {
    itinerary.legs.forEach(leg => {
      if (leg.booking && leg.booking.leg) {
        delete leg.booking.leg;
      }
      if (leg.bookingId) {
        delete leg.bookingId;
      }
    });
  }
  return {
    itinerary: itinerary,
  };
}

function createAndAppendBookings(itinerary, profile) {
  const completed = [];
  const failed = [];
  const cancelled = [];

  function appendOneBooking(leg) {
    const tspBooking = {
      id: utils.createId(),
      leg: leg,
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
    // Since Booking moneteraztion logic is actually in the leg, so PENDING and PAID state are dealt with during the logic with itinerary
    return changeBookingState(tspBooking, 'PENDING')
      .then(() => changeBookingState(tspBooking, 'PAID'))
      .then(() => tsp.createBooking(tspBooking))
      .then(
        booking => {
          return changeBookingState(booking, 'RESERVED')
            .then(() => {
              console.info(`Created booking ${booking.id}, agencyId ${booking.leg.agencyId}.`);
              completed.push(leg);
              leg.booking = booking;
            });
        },
        error => {
          console.warn(`Booking failed for agency ${leg.agencyId}`);
          console.warn(error);
          failed.push(leg);
        }
      );
  }

  function cancelOneBooking(leg) {
    return tsp.cancelBooking(leg.booking)
      .then(
        booking => {
          return Promise.all([
            stateMachine.changeState('Leg', leg.id, leg.state, 'CANCELLED'),
            changeBookingState(leg.booking, 'CANCELLED'),
          ])
          .spread((newLegState, cancelledBooking) => {
            cancelled.push(leg);
            leg.state = newLegState;
            leg.booking = cancelledBooking;
          });
        },

        error => {
          console.warn(`Could not cancel booking for ${leg.id}, cancel manually`);
        }
      );
  }

  return Promise.resolve(filterBookableLegs(itinerary.legs))
    .then(bookableLegs => Promise.map(bookableLegs, appendOneBooking))
    .then(_empty => {
      // In case of success, return the itinerary. In case of failure,
      // cancel the completed bookings.
      if (failed.length === 0) {
        return itinerary;
      }

      const failedLegStack = {
        failedLeg: failed.map(leg => {
          return {
            mode: leg.mode,
            agencyId: leg.agencyId,
          };
        }),
      };

      return Promise.map(completed, cancelOneBooking)
        .then(_empty => {
          const error = new MaaSError(`${failed.length} bookings failed.\nFailed legs: ${JSON.stringify(failedLegStack, null, 2)}`, 500);
          return Promise.reject(error);
        });
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
      return annotateItineraryState(annotatedItinerary, 'PLANNED');
    })
    .then(plannedItinerary => maasOperation.computeBalance(plannedItinerary.fare.points, cachedProfile))
    .then(newBalance => maasOperation.updateBalance(event.identityId, newBalance))
    .then(response => annotateItineraryState(annotatedItinerary, 'PAID'))
    .then(paidItinerary => createAndAppendBookings(paidItinerary, cachedProfile))
    .then(bookedItinerary => {
      console.info(`Created itinerary ${bookedItinerary.id} with ${bookedItinerary.legs.length} legs.`);
      return saveItinerary(parseDatabaseFormat(bookedItinerary));
    })
    .then(savedItinerary => wrapToEnvelope(savedItinerary))
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
    // console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

    Database.cleanup()
      .then(() => {
        if (_error instanceof MaaSError) {
          callback(_error);
          return;
        }

        callback(_error);
      });
  });
};
