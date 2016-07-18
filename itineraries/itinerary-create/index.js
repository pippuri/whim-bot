'use strict';

const Promise = require('bluebird');
const bus = require('../../lib/service-bus');
const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models/index');
const tsp = require('../../lib/tsp/index');
const stateMachine = require('../../lib/states/index').StateMachine;
const Database = models.Database;

function fetchCustomerProfile(identityId) {
  //console.log(`Fetch customer profile ${identityId}`);

  // FIXME The 'Item' envelope is unnecessary in profile
  return bus.call('MaaS-profile-info', {
    identityId: identityId,
  })
  .then(data => {
    // Append identity ID
    return Object.assign({ identityId: identityId }, data.Item);
  });
}

function filterBookableLegs(legs) {
  //console.log(`Filter ${legs.length} bookable legs`);

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

function validateSignatures(itinerary) {
  //console.log(`Validating itinerary signature ${itinerary.signature}`);

  // Verify that the data matches the signature
  const originalSignature = itinerary.signature;
  const withoutSignature = Object.assign({}, itinerary);
  delete withoutSignature.signature;

  const computedSignature = utils.sign(withoutSignature, process.env.MAAS_SIGNING_SECRET);

  if (originalSignature === computedSignature) {
    return Promise.resolve(itinerary);
  }

  console.warn(`Validation failed. Current: ${originalSignature} Expected: ${computedSignature}`);

  // FIXME change routeId term
  return Promise.reject(new MaaSError('Itinerary validation failed.', 400));
}

function removeSignatures(itinerary) {
  //console.log('Remove all signatures');

  // Remove old signatures and assign new ones
  delete itinerary.signature;
  itinerary.legs.forEach(leg => {
    delete leg.signature;
  });

  return itinerary;
}

function computeBalance(itinerary, profile) {
  //console.log(`Computing balance for ${profile.identityId}`);

  // Check that the user has sufficient balance
  const cost = itinerary.fare.points;
  const balance = profile.balance;
  const message = `Insufficent balance (required: ${cost}, actual: ${balance})`;

  //console.log(`Balance ${profile.identityId}`);

  if (balance > cost) {
    return balance - cost;
  }

  throw new MaaSError(message, 403);
}

function updateBalance(identityId, newBalance) {
  console.log(`Update new balance ${newBalance}`);

  return bus.call('MaaS-profile-edit', {
    identityId: identityId,
    payload: {
      balance: newBalance,
    },
  });
}

function annotateIdentifiers(itinerary) {
  // Assign fresh identifiers for the itinerary and legs
  itinerary.id = utils.createId();
  itinerary.legs.forEach(leg => {
    leg.id = utils.createId();
  });

  return itinerary;
}

function annotateIdentityId(itinerary, identityId) {
  itinerary.identityId = identityId;

  return itinerary;
}

function annotateLegsState(itinerary, state) {
  const queue = [];
  itinerary.legs.forEach(leg => {
    // Starting state
    leg.state = 'START';
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

function annotateItineraryState(itinerary, state) {
  // Starting state
  itinerary.state = 'START';

  return stateMachine.changeState('Itinerary', itinerary.id, itinerary.state, state)
    .then(newState => {
      itinerary.state = newState;

      return annotateLegsState(itinerary, state);
    })
    .then(itinerary => {
      return itinerary;
    });
}

function createAndAppendBookings(itinerary, profile) {

  const completed = [];
  const failed = [];
  const cancelled = [];

  function appendOneBooking(leg) {
    //console.log(`Create booking for ${leg.id}`);

    return tsp.createBooking(leg, profile)
      .then(
        booking => {
          //console.log(`Booking for ${leg.id} succeeded`);

          return stateMachine.changeState('Leg', leg.id, leg.state, 'PAID')
            .then(newState => {
              completed.push(leg);
              leg.state = newState;
              leg.booking = booking;
            });
        },

        error => {
          console.warn(error);
          console.warn(`Booking failed for agency ${leg.agencyId}`);
          failed.push(leg);
        }
      );
  }

  function cancelOneBooking(leg) {
    return tsp.cancelBooking(leg.booking)
      .then(
        booking => {
          return stateMachine.changeState('Leg', leg.id, leg.state, 'CANCELLED')
            .then(newState => {
              cancelled.push(leg);
              leg.state = newState;
            });
        },

        error => {
          console.warn(`Could not cancel booking for ${leg.id}, cancel manually`);
          return stateMachine.changeState('Leg', leg.id, leg.state, 'PAID')
            .then(newState => {
              cancelled.push(leg);
              leg.state = newState;
            });
        }
      );
  }

  return Promise.resolve(filterBookableLegs(itinerary.legs))
    .then(legs => Promise.map(legs, appendOneBooking))
    .then(_empty => {
      // In case of success, return the itinerary. In case of failure,
      // cancel the completed bookings.
      if (failed.length === 0) {
        return stateMachine.changeState('Itinerary', itinerary.id, itinerary.state, 'PAID')
          .then(newState => {
            itinerary.state = newState;
            return Promise.resolve(itinerary);
          });
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

function saveItinerary(itinerary) {
  //console.log(`Save itinerary ${itinerary.id} into db`);
  return models.Itinerary
    .query()
    .insertWithRelated(itinerary)
    .then(response => {
      return Promise.resolve(response);
    });
}

function wrapToEnvelope(itinerary) {
  //console.log(`Wrap itinerary ${itinerary.id} into response`);

  return {
    itinerary: itinerary,
    maas: {},
  };
}

module.exports.respond = function (event, callback) {

  const context = {};

  // Process & validate the input, then save the itinerary; then do bookings,
  // update balance and save both itinerary and profile.
  return Promise.all([
    Database.init(),
    validateSignatures(event.itinerary),
    fetchCustomerProfile(event.identityId),
  ])
  .spread((none, valid, profile) => {
    // Assign our inputs
    context.profile = profile;
    context.itinerary = event.itinerary;

    // Update itinerary for storable form
    removeSignatures(context.itinerary);
    annotateIdentifiers(context.itinerary);
    annotateIdentityId(context.itinerary, context.profile.identityId);
    return annotateItineraryState(context.itinerary, 'PLANNED');
  })
  .then(itinerary => createAndAppendBookings(itinerary, context.profile))
  .then(saveItinerary)
  .then(itinerary => {
    // Update input, update balance
    context.itinerary = itinerary;
    const balance = computeBalance(context.itinerary, context.profile);

    return updateBalance(context.profile.identityId, balance);
  })
  .then(profile => {
    Database.cleanup()
      .then(() => callback(null, wrapToEnvelope(context.itinerary)));
  })
  .catch(_error => {
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    let error = _error;
    if (!(error instanceof MaaSError)) {
      error = new MaaSError(`Internal server error: ${_error.toString()}`, 500);
    }

    // Uncaught, unexpected error
    Database.cleanup()
    .then(() => {
      callback(error);
    });
  });
};
