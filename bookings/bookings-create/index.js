'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const tsp = require('../../lib/tsp');
const utils = require('../../lib/utils');
const maasOperation = require('../../lib/maas-operation/index');
const Database = models.Database;

/**
 * Validate event input
 */
function validateInput(event) {
  // Require identityId and phone in input user profile
  if (!event.identityId || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId', 400));
  }

  if (!event.signature || event.signature === '') {
    return Promise.reject(new MaaSError('Missing signature', 400));
  }

  if (!event.leg || !event.leg.agencyId || event.leg.agencyId === '') {
    return Promise.reject(new MaaSError('Missing leg input'));
  }

  return Promise.resolve();
}

/**
 * Save booking to Postgres
 */
function saveBooking(booking) {
  return models.Booking.query().insert(booking);
}

/**
 * Create a booking for a leg OR an individual booking (Go on a whim)
 */
function createBooking(event) {
  const agencyId = event.leg.agencyId;

  return Promise.all([
    maasOperation.fetchCustomerProfile(event.identityId), // Get customer information
    utils.validateSignatures(event), // Validate request signature
  ])
  .spread((profile, validatedInput)  => {
    const customer = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
    };
    const booking = {
      bookingId: utils.createId(),
      state: 'NEW',
      leg: validatedInput.leg,
      customer: customer,
      term: validatedInput.term,
      meta: validatedInput.meta,
      signature: validatedInput.signature,
    };
    booking.leg.id = utils.createId();
    return [tsp.findAgency(agencyId), Promise.resolve(booking)];
  })
  .spread((tsp, booking) => {
    console.log('Booking with this order information: ', booking);

    const url = tsp.adapter.baseUrl + tsp.adapter.endpoints.post.book;
    const options = Object.assign({
      json: true,
      body: booking,
    }, tsp.adapter.options);

    // TODO determine whether to use Lambda or API !?
    return request.post(url, options); // Delegate booking call to specific TSP api endpoint
  })
  .then(booking => {
    // Parse a few fields to MaaS specific encoding
    let transformedBooking = Object.assign({}, booking, {
      id: booking.bookingId,
      tspId: booking.id,
    });
    delete transformedBooking.bookingId;
    transformedBooking = utils.removeSignatures(transformedBooking);
    return saveBooking(transformedBooking);
  });
}

module.exports.respond = (event, callback) => {

  return Promise.all([
    Database.init(),
    validateInput(event),
  ])
    .then(() => createBooking(event))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

      Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
