'use strict';

const request = require('request-promise-lite');
const utils = require('../../lib/utils');
const MaaSError = require('../errors/MaaSError');
const stateMachine = require('../../lib/states/index').StateMachine;
const Promise = require('bluebird');
const bus = require('../../lib/service-bus/index');

// Use a different set of TSP data, based on dev vs. production
const tspData = require(process.env.TSP_DATASET_PATH);

function toDatabaseFormat(booking) {

  const dbBooking = Object.assign({}, booking);
  return utils.removeSignatures(dbBooking);
}

function toTSPFormat(booking) {

  const tspBooking = Object.assign({}, booking);
  tspBooking.bookingId = booking.id;
  tspBooking.id = booking.tspId;
  delete tspBooking.tspId;

  return tspBooking;
}

/**
 * Find agency by their id
 *
 * Note: It's easier to have this returning a Promise <-Easier to read->
 */
function findAgency(agencyId) {
  // Handle case 'undefined'
  if (typeof agencyId !== 'string') {
    return Promise.reject(`Invalid agencyId "${agencyId}"`);
  }

  // Handle case of existing key
  const tsp = tspData[agencyId];
  if (tsp) {
    return Promise.resolve(tsp);
  }

  // Handle the case of spelling case mistake
  const agencyIdUpper = agencyId.toUpperCase();
  const upperCaseMatch = Object.keys(tspData)
    .find(t => agencyIdUpper === t.toUpperCase());

  if (upperCaseMatch) {
    return Promise.reject(new MaaSError(`Invalid input agencyId, do you mean "${tspData[upperCaseMatch]}"?`, 400));
  }

  return Promise.reject('No suitable TSP found with id ' + agencyId);
}

function invokeCall( tsp, method, action, options, objectId ) {
  let validLambda = false;

  if ( tsp.adapter.hasOwnProperty('lambdas') &&
    tsp.adapter.lambdas.hasOwnProperty(method) &&
    tsp.adapter.lambdas[method].hasOwnProperty(action) &&
    bus.canCall(tsp.adapter.lambdas[method][action])
   ) {
    validLambda = tsp.adapter.lambdas[method][action];
  }

  if ( validLambda ) {
    const payload = options.body;

    if ( objectId ) {
      Object.assign( payload, { id: objectId } );
    }

    return bus.call( validLambda, payload );
  }

  let url = tsp.adapter.baseUrl + tsp.adapter.endpoints[method][action];
  if ( objectId ) {
    url = url + '/' + objectId;
  }
  return request[method](url, options);
}

function containsAgency(agencyId) {
  return typeof tspData[agencyId] !== 'undefined';
}

/**
 * Change booking state and log the state change
 * @param {object} booking
 * @param {string} state
 * @return {Promise -> undefined}
 */
function changeBookingState(booking, state) {
  const oldState = booking.state || 'START';
  booking.state = state;
  return stateMachine.changeState('Booking', booking.id || booking.bookingId, oldState, booking.state);
}

// Create booking on TSP side
function createBooking(leg, profile, terms, meta) {
  const customer = {
    // TODO Maybe we should not leak identity id
    id: profile.identityId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
  };
  const booking = {
    id: utils.createId(),
    state: 'START',
    leg: leg,
    customer: customer,
    terms: terms,
    meta: meta,
  };

  return changeBookingState(booking, 'PENDING')
    .then(() => {
      // TODO: Insert some actual JAMES MAGIC which actually deducts points from user
      return changeBookingState(booking, 'PAID');
    })
    .then(() => findAgency(leg.agencyId))
    .then(tsp => {
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.config);
      return [booking, invokeCall( tsp, 'post', 'book', options )]; // Delegate booking call to specific TSP api endpoint
    })
    .spread((booking, tspResponse) => {
      ['terms', 'token', 'meta', 'leg', 'tspId'].forEach( key => {
        booking[key] = tspResponse[key];
      });
      if ( ! booking.tspId ) {
        booking.tspId = 'none';
      }
      return changeBookingState(booking, tspResponse.state)
        .then(() => booking );
    })
    .then(booking => toDatabaseFormat(booking));
    // TODO: JAMES MAGIC should catch failures and give points back
}

// Retrieve booking on TSP side
function retrieveBooking(tspId, agencyId) {

  return findAgency(agencyId)
    .then(tsp => {
      const options = Object.assign({ json: true }, tsp.adapter.config);

      return invokeCall( tsp, 'get', 'retrieve', options, tspId );
    })
    .then(booking => toDatabaseFormat(booking));
}

// Update booking on TSP side
function updateBooking(booking) {

  return findAgency(booking.leg.agencyId)
    .then(tsp => {
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.config);

      return invokeCall( tsp, 'put', 'update', options );
    })
    .then(booking => toDatabaseFormat(booking));
}

// Cancel booking on TSP side
function cancelBooking(booking) {
  console.log('TODO Cancel booking', JSON.stringify(tspData.booking, null, 2));

  return Promise.resolve(booking);
}

module.exports = {
  findAgency,
  containsAgency,
  retrieveBooking,
  createBooking,
  updateBooking,
  toDatabaseFormat,
  toTSPFormat,
  cancelBooking, // deprecated
};
