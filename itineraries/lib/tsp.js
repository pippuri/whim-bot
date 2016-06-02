const Promise = require('bluebird');
const request = require('request-promise-lite');
const data = require('./tspData.json');
const URL = require('url');

function findProvider(leg) {
  const provider = data[leg.agencyId];

  if (typeof provider === 'object') {
    return Promise.resolve(provider);
  }

  return Promise.reject('No suitable TSP found with id ' + leg.agencyId);
}

function createBooking(leg, profile) {
  const customer = {
    id: profile.identityId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
  };
  const booking = {
    state: 'NEW',
    leg: leg,
    customer: customer,
  };

  console.log('Create booking', JSON.stringify(booking, null, 2));
  return findProvider(leg)
    .then((tsp) => {
      const url = URL.resolve(tsp.adapter.baseUrl, 'bookings');
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.options);

      return request.post(url, options);
    });
}

function cancelBooking(booking) {
  console.log('TODO Cancel booking', JSON.stringify(data.booking, null, 2));

  return booking;
}

function createBookings(legs, profile) {
  const completed = [];
  const failed = [];

  function createOneBooking(leg) {
    return createBooking(leg, profile)
      .then(
        booking => completed.push(booking),
        error => failed.push(leg)
      );
  }

  // Resolve all bookings created if all succeed. Cancel all successful
  // bookings if one fails.
  return Promise.map(legs, createOneBooking)
    .then(() => {
      if (failed.length > 0) {
        throw new Error(failed.length + ' bookings failed!');
      }

      return completed;
    });
}

function cancelBookings(bookings) {
  const cancelled = [];
  const failed = [];

  function cancelOneBooking(booking) {
    return cancelBooking(booking)
      .then(
        _booking => cancelled.push(_booking),
        error => {
          console.warn('Error: Could not delete booking - cancel manually!');
          console.warn(JSON.stringify(booking));
        }
      );
  }

  return Promise.map(bookings, cancelOneBooking)
    .then((cancelled) => {
      if (cancelled.length > 0) {
        console.warn(failed.length + ' bookings cancelled.');
      }

      throw new Error('One or more bookings failed, rolling back.');
    });
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
  createBookings: createBookings,
  cancelBookings: cancelBookings,
};
