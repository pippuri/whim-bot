'use strict';

const request = require('request-promise-lite');
const utils = require('../../lib/utils');
const MaaSError = require('../errors/MaaSError');
const stateMachine = require('../../lib/states/index').StateMachine;
const Promise = require('bluebird');
const bus = require('../../lib/service-bus/index');

const actionMethodMap = {
  book: 'post',
  complete: 'post',
  retrieve: 'get',
  options: 'get',
  update: 'put',
  cancel: 'delete',
};

// Use a different set of TSP data, based on dev vs. production
const tspData = require(process.env.TSP_DATASET_PATH);

function toDatabaseFormat(booking) {

  const dbBooking = Object.assign({}, booking);
  return utils.removeSignatures(dbBooking);
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

function invokeTSPAction( tsp, action, options ) {
  const method = actionMethodMap[action];

  if ( ! method ) {
    throw new MaaSError( 'invokeTSPAction was called with unknown action: ' + action );
  }

  let validLambda = false;

  if ( tsp.adapter.hasOwnProperty('lambdas') &&
    tsp.adapter.lambdas.hasOwnProperty(method) &&
    tsp.adapter.lambdas[method].hasOwnProperty(action) &&
    bus.canCall(tsp.adapter.lambdas[method][action])
   ) {
    validLambda = tsp.adapter.lambdas[method][action];
  }

  if ( validLambda ) {
    const payload = options.body || {};

    if ( options.tspId ) {
      Object.assign( payload, { tspId: options.tspId } );
    }

    return bus.call( validLambda, payload );
  }

  let url = tsp.adapter.baseUrl + tsp.adapter.endpoints[method][action];
  Object.assign( options, { json: true } );
  Object.assign( options, tsp.adapter.endpoints_config || {} );

  if ( options.tspId ) {
    const tspId = delete options.tspId;
    if ( method === 'get' || method === 'delete' || method === 'put' ) {
      url = url + '/' + tspId;
    }
    if ( method === 'post' || method === 'put' ) {
      Object.assign( options.body, { tspId: tspId } );
    }
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
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    email: profile.email,
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
      const options = {
        body: {
          leg: booking.leg,
          meta: booking.meta,
          terms: booking.terms,
          customer: booking.customer,
        },
      };
      return [booking, invokeTSPAction( tsp, 'book', options )]; // Delegate booking call to specific TSP api endpoint
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
      const options = { tspId: tspId };

      return invokeTSPAction( tsp, 'retrieve', options );
    })
    .then(booking => toDatabaseFormat(booking));
}

// Update booking on TSP side
function updateBooking(booking) {
  return findAgency(booking.leg.agencyId)
    .then(tsp => {
      const options = { tspId: booking.tspId, body: booking };
      return invokeTSPAction( tsp, 'update', options );
    })
    .then(booking => toDatabaseFormat(booking));
}

// Cancel booking on TSP side
function cancelBooking(booking) {
  return findAgency(booking.leg.agencyId)
    .then(tsp => {
      const options = { tspId: booking.tspId, body: booking };
      return invokeTSPAction( tsp, 'cancel', options );
    })
    .then(booking => toDatabaseFormat(booking));
}

module.exports = {
  findAgency,
  containsAgency,
  retrieveBooking,
  createBooking,
  updateBooking,
  toDatabaseFormat,
  cancelBooking, // deprecated
};
