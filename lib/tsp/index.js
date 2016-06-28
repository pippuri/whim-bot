'use strict';

const request = require('request-promise-lite');
const tspData = require('./tspData.json');
const maasUtils = require('../../lib/utils');
const _ = require('lodash');
const MaasError = require('../errors/MaaSError');

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

<<<<<<< 04337087d3df52e8e8ab2e0d55b4c185261cd4ee
function findProvider(agencyId) {
  return data[agencyId];
=======
/**
 * Find agency by their id
 * Note: It's easier to have this returning a Promise <-Easier to read->
 */
function findAgency(agencyId) {

  const tspIdList = Object.keys(tspData).map(tspDatum => {
    return tspData[tspDatum].agencyId;
  });

  const tspIdListUpperCase = tspIdList.map(id => {
    return id.toUpperCase();
  });

  if (!_.includes(tspIdListUpperCase, agencyId.toUpperCase())) {
    return Promise.reject(new MaasError(`AgencyId "${agencyId}" not exist`, 500));
  }

  if (!_.includes(tspIdListUpperCase, agencyId.toUpperCase())) {
    return Promise.reject(new MaasError(`Invalid input agencyId, do you mean "${tspIdList[tspIdListUpperCase.indexOf(agencyId.toUpperCase())]}"?`, 400));
  }

  const agencyIdList = Object.keys(tspData).map(key => {
    return tspData[key].agencyId;
  });

  if (_.includes(agencyIdList, agencyId)) {
    return Promise.resolve(tspData[agencyId]);
  }

  return Promise.reject('No suitable TSP found with id ' + agencyId);
>>>>>>> Restructure lib files of itineraries and bookings altogether
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

<<<<<<< 04337087d3df52e8e8ab2e0d55b4c185261cd4ee
  if (!tsp) {
    return Promise.reject(`No suitable TSP found with id ${leg.agencyId}`);
  }
=======
  return findAgency(leg.agencyId)
    .then(tsp => {
      const url = tsp.adapter.baseUrl + tsp.adapter.endpoints.post.book;
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.config);

      console.log(url);
>>>>>>> Restructure lib files of itineraries and bookings altogether

  const url = URL.resolve(tsp.adapter.baseUrl, 'bookings');
  const options = Object.assign({
    json: true,
    body: booking,
  }, tsp.adapter.options);

  return request.post(url, options)
    .then(booking => toDatabaseFormat(booking));
}

function retrieveBooking(tspId, agencyId) {

<<<<<<< 04337087d3df52e8e8ab2e0d55b4c185261cd4ee
  const tsp = findProvider(agencyId);

  if (!tsp) {
    return Promise.reject(`No suitable TSP found with id ${agencyId}`);
  }
=======
  return findAgency(agencyId)
    .then(tsp => {
      const url = tsp.adapter.baseUrl + tsp.adapter.endpoints.get.retrieve + '/' + tspId;
      const options = Object.assign({
        json: true,
      }, tsp.adapter.config);
>>>>>>> Restructure lib files of itineraries and bookings altogether

  const url = URL.resolve(tsp.adapter.baseUrl, `bookings/${tspId}`);
  const options = Object.assign({
    json: true,
  }, tsp.adapter.options);

      return request.get(url, options);
    })
    .then(booking => toDatabaseFormat(booking));
}

function updateBooking(booking) {
<<<<<<< 04337087d3df52e8e8ab2e0d55b4c185261cd4ee
<<<<<<< 09d6ab6d07b5657c952bc743731c59fa7a3b79c0

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
=======
  return findProvider(booking.leg.agencyId)
=======
  return findAgency(booking.leg.agencyId)
>>>>>>> Restructure lib files of itineraries and bookings altogether
    .then(tsp => {
      const url = tsp.adapter.baseUrl + tsp.adapter.endpoints.put.update + '/' + booking.tspId;
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.config);

      console.log(url);

      return request.put(url, options);
    })
>>>>>>> Move knex to respond export, initKnex return Promise
    .then(booking => toDatabaseFormat(booking));
}

function cancelBooking(booking) {
  console.log('TODO Cancel booking', JSON.stringify(tspData.booking, null, 2));

  return Promise.resolve(booking);
}

module.exports = {
  findAgency,
  retrieveBooking,
  createBooking,
  updateBooking,
  toDatabaseFormat,
  toTSPFormat,
  cancelBooking, // deprecated
};
