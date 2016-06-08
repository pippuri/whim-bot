const URL = require('url');
const Promise = require('bluebird');
const knexFactory = require('knex');
const Model = require('objection').Model;
const bus = require('../../lib/service-bus');
const maasUtils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError.js');
const models = require('../../lib/models');
const tsp = require('../lib/tsp.js');

function initKnex() {
  // FIXME Change variable names to something that tells about MaaS in general
  const connection = URL.format({
    protocol: 'postgres:',
    slashes: true,
    hostname: process.env.MAAS_PGHOST,
    port: process.env.MAAS_PGPORT,
    auth: process.env.MAAS_PGUSER + ':' + process.env.MAAS_PGPASSWORD,
    pathname: '/' + process.env.MAAS_PGDATABASE,
  });
  const config = {
    client: 'postgresql',
    connection: connection,
    pool: {
      min: 1,
      max: 1,
    },
  };

  const knex = knexFactory(config);
  Model.knex(knex);

  return knex;
}

function fetchCustomerProfile(identityId) {
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
        return true;
    }
  });
}

function validateSignatures(itinerary) {
  // Verify that the data matches the signature
  const originalSignature = itinerary.signature;
  const withoutSignature = Object.assign({}, itinerary);
  delete withoutSignature.signature;

  const computedSignature = maasUtils.sign(withoutSignature, process.env.MAAS_SIGNING_SECRET);

  if (originalSignature === computedSignature) {
    return Promise.resolve(itinerary);
  }

  // FIXME change routeId term
  return Promise.reject(new MaaSError('Itinerary validation failed.', 400));
}

function removeSignatures(itinerary) {
  // Remove old signatures and assign new ones
  delete itinerary.signature;
  itinerary.legs.forEach(leg => {
    delete leg.signature;
  });

  return itinerary;
}

function computeBalance(itinerary, profile) {
  // Check that the user has sufficient balance
  const cost = itinerary.fare.points;
  const balance = profile.balance;
  const message = `Insufficent balance (required: ${cost}, actual: ${balance})`;

  if (balance > cost) {
    return balance - cost;
  }

  throw new MaaSError(message, 403);
}

function updateBalance(identityId, newBalance) {
  return bus.call('MaaS-profile-edit', {
    identityId: identityId,
    payload: {
      balance: newBalance,
    },
  });
}

function annotateIdentifiers(itinerary) {
  // Assign fresh identifiers for the itinerary and legs
  itinerary.id = maasUtils.createId();
  itinerary.legs.forEach(leg => {
    leg.id = maasUtils.createId();
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
    return tsp.createBooking(leg, profile)
      .then(
        booking => {
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
  return models.Itinerary
    .query()
    .insertWithRelated(itinerary);
}

function wrapToEnvelope(itinerary) {
  return {
    itinerary: itinerary,
    maas: {},
  };
}

module.exports.respond = function (event, callback) {
  var knex;
  var profile;
  var itinerary;

  // Process & validate the input, then save the itinerary; then do bookings,
  // update balance and save both itinerary and profile.
  return Promise.props({
      knex: initKnex(),
      valid: validateSignatures(event.itinerary),
      profile: fetchCustomerProfile(event.identityId),
    })
    .then(_input => {

      // Assign our inputs
      itinerary = event.itinerary;
      knex = _input.knex;
      profile = _input.profile;

      // Update itinerary for storable form
      removeSignatures(itinerary);
      annotateIdentifiers(itinerary);
      annotateIdentityId(itinerary, profile.identityId);

      return createAndAppendBookings(itinerary, profile);
    })
    .then(saveItinerary)
    .then(_itinerary  => {

      // Update input, update balance
      itinerary = _itinerary;
      const balance = computeBalance(itinerary, profile);

      return updateBalance(profile.identityId, balance);
    })
    .then(profile => callback(null, wrapToEnvelope(itinerary)))
    .catch(MaaSError, callback)
    .catch(_error => {

      // Uncaught, unexpected error
      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    })
    .finally(() => {
      // Close all db connections
      if (knex) {
        knex.destroy();
      }
    });
};
