const URL = require('url');
const Promise = require('bluebird');
const bus = require('../../lib/service-bus');
const maasUtils = require('../../lib/utils');
const tsp = require('../lib/tsp.js');
const knexFactory = require('knex');
const Model = require('objection').Model;
const models = require('../../lib/models');

// Initialize knex.
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
    min: 2,
    max: 10,
  },
};
const knex = knexFactory(config);
Model.knex(knex);

function fetchCustomerProfile(identityId) {

  // FIXME The 'Item' envelope is unnecessary in profile
  return bus.call('MaaS-profile-info', {
    identityId: identityId,
  })
  .then(data => data.Item);
}

function filterBookableLegs(legs) {
  // Filter away the legs that do not need a TSP
  return legs.filter(leg => {
    switch (leg.mode) {
      // Erraneous data
      case 'undefined':
        var msg = 'No mode available for leg ' + JSON.stringify(leg, null, 2);
        throw new Error(msg);

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

function validateSignature(itinerary, profile) {
  // Verify that the data matches the signature
  const originalSignature = itinerary.signature;
  var withoutSignature = Object.assign({}, itinerary);
  delete withoutSignature.signature;

  const computedSignature = maasUtils.sign(withoutSignature, process.env.MAAS_SIGNING_SECRET);

  if (originalSignature === computedSignature) {
    return Promise.resolve(itinerary);
  }

  // FIXME change routeId term
  Promise.reject(new Error('Itinerary validation failed.'));
}

function computeBalance(itinerary, profile) {
  // Check that the user has sufficient balance
  const cost = itinerary.fare.points;
  const balance = profile.balance;
  const message = `Insufficent balance (required: ${cost}, actual: ${balance})`;

  //if (balance > cost) {
    return Promise.resolve(balance - cost);
  //}

  // FIXME change routeId term
  Promise.reject(new Error(message));
}

function updateBalance(profile, newBalance) {
  return bus.call('MaaS-profile-edit', {
    identityId: profile.identityId,
    payload: {
      balance: newBalance,
    }
  });
}

function annotateItinerary(_itinerary, profile, bookings) {
  // Copy the main itinerary object, annotate it with user info
  const itineraryCore = {
    identityId: profile.identityId,
  };
  const itinerary = Object.assign({}, _itinerary, itineraryCore);

  // Annotate the legs with booking information if needed
  itinerary.legs.forEach(leg => {
    // Find the booking that matches the leg
    const booking = bookings.find(booking => booking.leg.signature === leg.signature);

    // In case of no booking, this is a leg that customer should take manually
    if (!booking) {
      return;
    }

    // Isolate the booking core - we don't need duplicate leg or customer info
    const bookingCore = {
      id: booking.signature,
      state: booking.state,
      token: booking.token,
      meta: booking.meta,
    };

    // Append booking information for the leg
    leg.booking = bookingCore;
  });

  return itinerary;
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
  var input;
  var itinerary;
  var balance;

  // Validate the input route, fetch profile, do bookings and update user profile
  return Promise.props({
      valid: validateSignature(event.itinerary),
      profile: fetchCustomerProfile(event.identityId),
      legs: filterBookableLegs(event.itinerary.legs),
    })
    .then(_input      => input = _input)
    .then(_empty      => computeBalance(event.itinerary, input.profile))
    .then(_newBalance => balance = _newBalance)
    .then(_newBalance => tsp.createBookings(input.legs, input.profile))
    .then(bookings    => annotateItinerary(event.itinerary, input.profile, bookings))
    .then(_itinerary  => saveItinerary(_itinerary))
    .then(_itinerary  => itinerary = _itinerary)
    .then(_itinerary  => updateBalance(input.profile, balance))
    .then(profile     => wrapToEnvelope(itinerary))
    .then(
      response        => callback(null, response),
      error           => callback(error, null)
    );
};
