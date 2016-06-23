'use strict';

const request = require('request-promise-lite');
const data = require('./tspData.json');
const URL = require('url');
const maasUtils = require('../../lib/utils');

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

function findProvider(agencyId) {
  return data[agencyId];
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
  const tsp = findProvider(leg.agencyId);

  if (!tsp) {
    return Promise.reject(`No suitable TSP found with id ${leg.agencyId}`);
  }

  const url = URL.resolve(tsp.adapter.baseUrl, 'bookings');
  const options = Object.assign({
    json: true,
    body: booking,
  }, tsp.adapter.options);

  return request.post(url, options)
    .then(booking => toDatabaseFormat(booking));
}

function retrieveBooking(tspId, agencyId) {

  const tsp = findProvider(agencyId);

  if (!tsp) {
    return Promise.reject(`No suitable TSP found with id ${agencyId}`);
  }

  const url = URL.resolve(tsp.adapter.baseUrl, `bookings/${tspId}`);
  const options = Object.assign({
    json: true,
  }, tsp.adapter.options);

  return request.get(url, options)
    .then(booking => toDatabaseFormat(booking));
}

function updateBooking(booking) {

  const tsp = findProvider(booking.leg.agencyId);

  if (!tsp) {
    return Promise.reject(`No suitable TSP found with id ${booking.leg.agencyId}`);
  }

  const url = URL.resolve(tsp.adapter.baseUrl, `${booking}/${booking.tspId}`);
  const options = Object.assign({
    json: true,
    body: booking,
  }, tsp.adapter.options);

  return request.put(url, options)
    .then(booking => toDatabaseFormat(booking));
}

function cancelBooking(booking) {
  console.log('TODO Cancel booking', JSON.stringify(data.booking, null, 2));

  return Promise.resolve(booking);
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
