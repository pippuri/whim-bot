'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const data = require('./tspData.json');
const URL = require('url');
const maasUtils = require('../../lib/utils');

function findProvider(leg) {
  const provider = data[leg.agencyId];

  if (typeof provider === 'object') {
    return Promise.resolve(provider);
  }

  return Promise.reject('No suitable TSP found with id ' + leg.agencyId);
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

  return findProvider(leg)
    .then(tsp => {
      const url = URL.resolve(tsp.adapter.baseUrl, 'bookings');
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.options);

      return request.post(url, options)
        .then(booking => {
          // Parse a few fields to MaaS specific encoding
          const transformedBooking = Object.assign({}, booking, {
            id: booking.bookingId,
            tspId: booking.id,
          });
          delete transformedBooking.bookingId;

          return transformedBooking;
        });
    });
}

function cancelBooking(booking) {
  console.log('TODO Cancel booking', JSON.stringify(data.booking, null, 2));

  return Promise.resolve(booking);
}

function dummy(booking) {
  Promise.resolve(booking);
}

module.exports = {
  findProvider: findProvider,
  createBooking: createBooking,
  updateBooking: dummy,
  cancelBooking: cancelBooking,
  payBooking: dummy,
};
