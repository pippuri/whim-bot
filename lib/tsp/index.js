'use strict';

const request = require('request-promise-lite');
const utils = require('../../lib/utils');
const MaaSError = require('../errors/MaaSError');

// Use a different set of TSP data, based on dev vs. production
const tspData = require(process.env.TSP_DATASET_PATH);

function toDatabaseFormat(booking) {

  const dbBooking = Object.assign({}, booking);
  dbBooking.tspId = booking.id;
  dbBooking.id = booking.bookingId;
  delete dbBooking.bookingId;

  return dbBooking;
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

// Create booking on TSP side
function createBooking(leg, profile) {
  const customer = {
    // TODO Maybe we should not leak identity if
    id: profile.identityId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
  };
  const booking = {
    bookingId: utils.createId(),
    state: 'NEW',
    leg: leg,
    customer: customer,
  };

  return findAgency(leg.agencyId)
    .then(tsp => {
      const url = tsp.adapter.baseUrl + tsp.adapter.endpoints.post.book;
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.config);

      /*console.log(
        `Creating a TSP booking to ${url} for agency \
        ${leg.agencyId} for leg ${leg.id}`
      );*/

      return request.post(url, options)
        .then(booking => toDatabaseFormat(booking));
    });
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
