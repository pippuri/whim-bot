'use strict';

const request = require('request-promise-lite');
const utils = require('../../lib/utils');
const MaasError = require('../errors/MaaSError');
const Promise = require('bluebird');
const bus = require('../../lib/service-bus/index');

const actionMethodMap = {
  book: 'post',
  complete: 'post',
  retrieve: 'get',
  options: 'get',
  update: 'put',
  cancel: 'del',
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
    return Promise.reject(new MaasError(`Invalid input agencyId, do you mean "${tspData[upperCaseMatch]}"?`, 400));
  }

  return Promise.reject('No suitable TSP found with id ' + agencyId);
}

function invokeTSPAction( tsp, action, options ) {
  const method = actionMethodMap[action];

  if ( ! method ) {
    throw new Error( 'invokeTSPAction was called with unknown action: ' + action );
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
    const payload = Object.assign( {}, options.body || {}, options.qs || {} );

    if ( options.tspId ) {
      Object.assign( payload, { tspId: options.tspId } );
    }
    return bus.call( validLambda, payload );
  }

  let url = tsp.adapter.baseUrl + tsp.adapter.endpoints[method][action];
  Object.assign( options, { json: true }, tsp.adapter.endpointsConfig || {} );
  if ( options.tspId ) {
    const tspId = options.tspId;
    delete options.tspId;
    if ( method === 'get' || method === 'del' || method === 'put' ) {
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

function retrieveBookingOptions(agencyId, options) {
  return findAgency(agencyId)
    .then(tsp => {
      const tspOptions = {
        qs: {
          mode: options.mode,
          from: options.from,
          to: options.to,
          startTime: options.startTime,
          endTime: options.endTime,
          fromRadius: options.fromRadius,
          toRadius: options.toRadius,
        },
      };
      return invokeTSPAction( tsp, 'options', tspOptions );
    } );
}

/**
 * Create a booking with TSP adapter
 * @param {Object} booking - newBooking object
 */
function createBooking(booking) {
  if (!booking || !booking.leg || !booking.meta || !booking.customer) {
    return Promise.reject(new MaasError('Missing booking information', 400));
  }

  return findAgency(booking.leg.agencyId)
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
      if (tspResponse.errorMessage) {
        const error = new MaasError(JSON.stringify(tspResponse, null, 2).replace(/\\n/g, '').replace(/\\/g, ''), 500);
        return Promise.reject(error);
      }

      const newBooking = Object.assign({}, booking, {
        tspId: tspResponse.tspId,
        terms: tspResponse.terms,
        token: tspResponse.token,
        meta: tspResponse.meta,
        leg: tspResponse.leg,
      });
      // FIXME: Move agencyId out of the 'leg'; it is dangerous to assume
      // the 'leg' object to be co-owned both by MaaS and a TSP
      newBooking.leg.agencyId = booking.leg.agencyId;

      return toDatabaseFormat(newBooking);
    });
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
      const options = { tspId: booking.tspId };
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
  retrieveBookingOptions,
  cancelBooking, // deprecated
};
