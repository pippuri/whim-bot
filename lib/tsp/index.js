'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const data = require('./tspData.json');
const URL = require('url');
const maasUtils = require('../../lib/utils');

function findProvider(agencyId) {
  const provider = data[agencyId];

  if (typeof provider === 'object') {
    return Promise.resolve(provider);
  }

  return Promise.reject(`No suitable TSP found with id ${agencyId}`);
}

function createBooking(leg, profile) {
  const customer = {
    // TODO Maybe we should not leak identity if
    id: profile.identityId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
  };
  const booking = {
    bookingId: maasUtils.createId(),
    state: 'NEW',
    leg: leg,
    customer: customer,
  };

  return findProvider(leg.agencyId)
    .then(tsp => {
      const url = URL.resolve(tsp.adapter.baseUrl, 'bookings');
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.options);

      return request.post(url, options);
    })
    .then(booking => toDatabaseFormat(booking));
}

function retrieveBooking(tspId, agencyId) {

  return findProvider(agencyId)
    .then(tsp => {
      const url = URL.resolve(tsp.adapter.baseUrl, `bookings/${tspId}`);
      const options = Object.assign({
        json: true,
      }, tsp.adapter.options);

      console.log(url); 

      return request.get(url, options);
    });
}

function updateBooking(booking) {
  return findProvider(booking.leg.agencyId)
    .then(tsp => {
      const url = URL.resolve(tsp.adapter.baseUrl, `${bookings}/${tspId}`);
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.options);

      return request.put(url, options);
    })
}

function cancelBooking(booking) {
  console.log('TODO Cancel booking', JSON.stringify(data.booking, null, 2));

  return Promise.resolve(booking);
}

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

module.exports = {
  findProvider: findProvider,
  retrieveBooking: retrieveBooking,
  createBooking: createBooking,
  updateBooking: updateBooking,
  toDatabaseFormat: toDatabaseFormat,
  toTSPFormat: toTSPFormat,
  cancelBooking: cancelBooking, // deprecated
};
