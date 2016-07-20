'use strict';

const request = require('request-promise-lite');
const utils = require('../../lib/utils');
const MaaSError = require('../errors/MaaSError');
const stateMachine = require('../../lib/states/index').StateMachine;
const Promise = require('bluebird');


// Use a different set of TSP data, based on dev vs. production
const tspData = require(process.env.TSP_DATASET_PATH);

function toDatabaseFormat(booking) {

  const dbBooking = Object.assign({}, booking);
  dbBooking.tspId = booking.id;
  dbBooking.id = booking.bookingId;
  delete dbBooking.bookingId;
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
function createBooking(leg, profile, term, meta) {
  const customer = {
    // TODO Maybe we should not leak identity id
    id: profile.identityId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
  };
  const booking = {
    bookingId: utils.createId(),
    state: 'START',
    leg: leg,
    customer: customer,
    term: term,
    meta: meta,
  };

  return changeBookingState(booking, 'PENDING')
    .then(() => findAgency(leg.agencyId))
    .then(foundTsp => {
      // TODO determine whether to use Lambda or API !?
      const url = foundTsp.adapter.baseUrl + foundTsp.adapter.endpoints.post.book;
      const options = Object.assign({
        json: true,
        body: booking,
      }, foundTsp.adapter.config);
      // TODO: change state to new so adapters are happy. Remove this once the TSP adapters have been updated
      booking.state = 'NEW';
      return [booking, request.post(url, options)]; // Delegate booking call to specific TSP api endpoint
    })
    .spread((originalBooking, alteredBooking) => {
      // TODO: change state back to pending so the state machine is happy. Remove this once the TSP adapters have been updated
      originalBooking.state = 'PENDING';
      // TODO: This is a workaround to change the tsp reference state from old version to new version. Remove this once the TSP adapters have been updated
      if ( alteredBooking.state === 'BOOKED' || alteredBooking.state === 'NEW') {
        alteredBooking.state = 'RESERVED';
      }
      return stateMachine.changeState('Booking', alteredBooking.id, originalBooking.state, alteredBooking.state)
        .then(() => Promise.resolve(alteredBooking));
    })
    .then(booking => toDatabaseFormat(booking));
}

// Retrieve booking on TSP side
function retrieveBooking(tspId, agencyId) {

  return findAgency(agencyId)
    .then(tsp => {
      const url = tsp.adapter.baseUrl + tsp.adapter.endpoints.get.retrieve + '/' + tspId;
      const options = Object.assign({ json: true }, tsp.adapter.config);

      return request.get(url, options);
    })
    .then(booking => toDatabaseFormat(booking));
}

// Update booking on TSP side
function updateBooking(booking) {

  return findAgency(booking.leg.agencyId)
    .then(tsp => {
      const url = tsp.adapter.baseUrl + tsp.adapter.endpoints.put.update + '/' + booking.tspId;
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.config);

      console.log(url);

      return request.put(url, options);
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
