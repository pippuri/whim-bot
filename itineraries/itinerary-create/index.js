'use strict';

const Promise = require('bluebird');
const bus = require('../../lib/service-bus');
const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models/index');
const tsp = require('../../lib/tsp/index');

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
        if (tsp.findAgency(leg.agencyId)) {
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

          completed.push(leg);
          leg.booking = booking;
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
        booking => cancelled.push(leg),

        error => {
          console.warn(`Could not cancel booking for ${leg.id}, cancel manually`);
        }
      );
  }

  return Promise.resolve(filterBookableLegs(itinerary.legs))
    .then(legs => Promise.map(legs, appendOneBooking))
    .then(_empty => {
      // In case of success, return the itinerary. In case of failure,
      // cancel the completed bookings.
      if (failed.length === 0) {
        return Promise.resolve(itinerary);
      }

      return Promise.map(completed, cancelOneBooking)
        .then(_empty => {
          const error = new MaaSError(`${failed.length} bookings failed.`, 500);
          return Promise.reject(error);
        });
    });
}

function saveItinerary(itinerary) {
  //console.log(`Save itinerary ${itinerary.id} into db`);

  return models.Itinerary
    .query()
    .insertWithRelated(itinerary);
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
    models.init(),
    validateSignatures(event.itinerary),
    fetchCustomerProfile(event.identityId),
  ])
  .spread((knex, valid, profile) => {

    context.knex = knex;
    context.profile = profile;

    // Assign our inputs
    context.itinerary = event.itinerary;

    // Update itinerary for storable form
    removeSignatures(context.itinerary);
    annotateIdentifiers(context.itinerary);
    annotateIdentityId(context.itinerary, context.profile.identityId);

    return createAndAppendBookings(context.itinerary, context.profile);
  })
  .then(saveItinerary)
  .then(itinerary  => {

    // Update input, update balance
    context.itinerary = itinerary;
    const balance = computeBalance(context.itinerary, context.profile);

    return updateBalance(context.profile.identityId, balance);
  })
  .then(profile => callback(null, wrapToEnvelope(context.itinerary)))
  .catch(MaaSError, callback)
  .catch(_error => {

    // Uncaught, unexpected error
    callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
  })
  .finally(() => {
    // Close all db connections
    if (context.knex) {
      context.knex.destroy();
    }
  });
};
