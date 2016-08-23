'use strict';

const request = require('request-promise-lite');
const utils = require('../../lib/utils');
const MaaSError = require('../errors/MaaSError');
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
    return Promise.reject(new MaaSError(`Invalid input agencyId, do you mean "${tspData[upperCaseMatch]}"?`, 400));
  }

  return Promise.reject('No suitable TSP found with id ' + agencyId);
}

/**
 * Invokes a TSP specific action
 *
 * In case an action does not exist,
 */
function invokeTSPAction(tsp, action, options ) {
  if (!tsp) {
    return Promise.reject(new Error('No TSP given'));
  }

  if (!tsp) {
    return Promise.reject(new Error('No action given given'));
  }

  const method = actionMethodMap[action];
  if (!method) {
    return Promise.reject(new Error(`No mapping found for action ${action}`));
  }

  let validLambda = false;

  if (tsp.adapter.hasOwnProperty('lambdas') &&
    tsp.adapter.lambdas.hasOwnProperty(method) &&
    tsp.adapter.lambdas[method].hasOwnProperty(action) &&
    bus.canCall(tsp.adapter.lambdas[method][action])
   ) {
    validLambda = tsp.adapter.lambdas[method][action];
  }

  if (validLambda) {
    const payload = Object.assign({}, options.body || {}, options.qs || {} );

    if (options.tspId) {
      Object.assign(payload, { tspId: options.tspId });
    }
    return bus.call(validLambda, payload);
  }

  let url = tsp.adapter.baseUrl + tsp.adapter.endpoints[method][action];
  Object.assign(options, { json: true }, tsp.adapter.endpointsConfig || {});
  if (options.tspId) {
    const tspId = options.tspId;
    delete options.tspId;

    if (method === 'get' || method === 'del' || method === 'put') {
      url = url + '/' + tspId;
    }

    if (method === 'post' || method === 'put' ) {
      Object.assign( options.body, { tspId: tspId } );
    }
  }
  console.info(`Executing request ${url}, ${JSON.stringify(options)}`);
  return request[method](url, options);
}

/**
 * Merges the TSP response data on top of an existing booking safely.
 * Returns a new object - none of the input values are touched.
 * The values being merged are tspId, terms, token, meta and leg.
 *
 * Note that the caller should still validate that the merged object is
 * logically valid.
 *
 * @param booking an existing booking
 * @param delta a booking delta, returned by TSP
 * @return new object consisting of old booking, and delta on top of it
 */
function mergeBookingDelta(booking, delta) {

  // Make a copy of the booking, because we do not want to change it
  const copy = utils.cloneDeep(booking);

  // FIXME: Move agencyId out of the 'leg'; it is dangerous to assume
  // the 'leg' object to be co-owned both by MaaS and a TSP
  const newBooking = Object.assign({}, booking, {
    tspId: utils.merge(copy.tspId, delta.tspId),
    terms: utils.merge(copy.terms, delta.terms),
    token: utils.merge(copy.token, delta.token),
    meta: utils.merge(copy.meta, delta.meta),
    leg: utils.merge(copy.leg, delta.leg),
  });

  return newBooking;
}

function containsAgency(agencyId) {
  return typeof tspData[agencyId] !== 'undefined';
}

/**
 * Determines whether a TSP can perform the given action.
 *
 * @param agencyId the identifier of a TSP
 * @param action to be executed
 * @return true if the action is supported & can be run; false otherwise
 */
function supportsAction(agencyId, action) {
  const method = actionMethodMap[action];

  return (typeof method !== typeof undefined);
}

function retrieveBookingOptions(agencyId, options) {
  return findAgency(agencyId)
    .then(tsp => {
      const tspOptions = {
        qs: {
          mode: options.mode,
          from: options.from ? options.from.join(',') : undefined,
          to: options.to ? options.to.join(',') : undefined,
          startTime: options.startTime,
          endTime: options.endTime,
          fromRadius: options.fromRadius,
          toRadius: options.toRadius,
        },
      };
      return invokeTSPAction( tsp, 'options', tspOptions );
    });
}

/**
 * Create a booking with TSP adapter
 * @param {Object} booking - newBooking object
 */
function createBooking(booking) {
  if (!booking || !booking.leg || !booking.meta || !booking.customer || !booking.leg.agencyId) {
    const message = 'createBooking: Missing booking information; ' +
      `booking: ${booking}, booking.leg: ${booking.leg}, booking.meta: ${booking.meta}, ` +
      `booking.customer: ${booking.customer}, booking.customer.agencyId: ${booking.customer.agencyId}`;
    return Promise.reject(new Error(message));
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
        const error = new MaaSError(JSON.stringify(tspResponse, null, 2).replace(/\\n/g, '').replace(/\\/g, ''), 500);
        return Promise.reject(error);
      }

      const newBooking = mergeBookingDelta(booking, tspResponse);
      return toDatabaseFormat(newBooking);
    });
}

/**
 * Retrieves a booking (delta) from the TSP side. This information is to be
 * merged with an existing booking information.
 *
 * In case a TSP does not implement 'retrieve' endpoint, an empty object delta
 * is returned.
 *
 * @param tspId The id of the booking, as represented in the TSP
 * @param agencyId the agencyId the agency the booking relates with
 */
function retrieveBooking(tspId, agencyId) {
  if (typeof tspId === 'undefined' || typeof agencyId === 'undefined') {
    const message = `retrieveBooking: Missing information; tspId: ${tspId}, agencyId: ${agencyId}`;
    return Promise.reject(new Error(message));
  }

  return findAgency(agencyId)
    .then(tsp => {
      const options = { tspId: tspId };

      if (!supportsAction(tsp, 'retrieve')) {
        console.info(`Action 'retrieve' not supported for ${agencyId}, returning empty for tspId ${tspId}`);
        return Promise.resolve({});
      }

      return invokeTSPAction( tsp, 'retrieve', options );
    })
    .then(booking => toDatabaseFormat(booking));
}

// Update booking on TSP side
function updateBooking(booking) {
  if (!booking || !booking.leg || !booking.leg.agencyId) {
    const message = 'createBooking: Missing booking information; ' +
      `booking: ${booking}, booking.leg: ${booking.leg}, ` +
      `booking.leg.agencyId: ${booking.customer.agencyId}`;
    return Promise.reject(new Error(message));
  }

  return findAgency(booking.leg.agencyId)
    .then(tsp => {
      const options = { tspId: booking.tspId, body: booking };
      return invokeTSPAction( tsp, 'update', options );
    })
    .then(tspResponse => {
      if (tspResponse.state !== booking.state) {
        return Promise.reject(`Booking ${booking.id} not cancelled for TSP ${booking.leg.agencyId}`);
      }

      return Promise.resolve(tspResponse);
    })
    .then(tspResponse => {
      const updatedBooking = mergeBookingDelta(booking, tspResponse);

      // TODO Check that we don't accidentally overwrite the old values
      return updatedBooking;
    })
    .then(booking => toDatabaseFormat(booking));
}

// Cancel booking on TSP side
function cancelBooking(booking) {
  if (!booking || !booking.leg || !booking.leg.agencyId) {
    const message = 'createBooking: Missing booking information; ' +
      `booking: ${booking}, booking.leg: ${booking.leg}, booking.meta: ${booking.meta} ` +
      `booking.customer: ${booking.customer}, booking.customer.agencyId: ${booking.customer.agencyId}`;
    return Promise.reject(new Error(message));
  }

  return findAgency(booking.leg.agencyId)
    .then(tsp => {
      const options = { tspId: booking.tspId };
      return invokeTSPAction( tsp, 'cancel', options );
    })
    .then(tspResponse => {
      if (tspResponse.state && tspResponse.state !== 'CANCELLED') {
        const message = `Booking ${booking.id} not cancelled for TSP ${booking.leg.agencyId}, response state ${tspResponse.state}`;

        return Promise.reject(new MaaSError(message, 400));
      }

      return Promise.resolve(tspResponse);
    })
    .then(tspResponse => {
      // Merge the values; if TSP succeeds, we do not need to care about its return values
      const updatedBooking = mergeBookingDelta(booking, { state: 'CANCELLED' });

      // TODO Check that we don't accidentally overwrite the old values
      return updatedBooking;
    })
    .then(updatedBooking => toDatabaseFormat(booking));
}

module.exports = {
  findAgency,
  containsAgency,
  retrieveBooking,
  createBooking,
  updateBooking, // deprecated
  toDatabaseFormat,
  retrieveBookingOptions,
  cancelBooking,
  mergeBookingDelta,
};
