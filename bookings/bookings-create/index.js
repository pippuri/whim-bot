'use strict';

const Promise = require('bluebird');
const maasUtils = require('../../lib/utils');
const request = require('request-promise-lite');
const MaasError = require('../../lib/errors/MaaSError');
const lib = require('../lib/index');
const _ = require('lodash');

// Require postgres, so that it will be bundled
// eslint-disable-next-line no-unused-vars
const pg = require('pg');

// Global knex connection variable
let knex;

/**
 * Save booking to Postgre
 */
function saveBooking(booking) {
  return knex
    .insert(booking, ['*'])
    .into('Booking')
    .then(booking => {
      if (_.isArray(booking) && booking.length !== 1) {
        return Promise.reject(new MaasError('Booking failed', 500));
      }

      if (booking[0].tspId) {
        delete booking[0].tspId;
      }

      return booking[0];
    });
}

/**
 * Create a booking for a leg OR an individual booking ( Go on a whim)
 */
function createBooking(event) {

  let agencyId;

  // Require identityId and phone in input user profile
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaasError('Missing identityId', 400));
  }

  if (!event.hasOwnProperty('signature') || event.signature === '') {
    return Promise.reject(new MaasError('Missing signature', 400));
  }

  if (event.hasOwnProperty('leg') && Object.keys(event.leg).length !== 0 && event.leg.hasOwnProperty('agencyId') && event.leg.agencyId !== '') {
    agencyId = event.leg.agencyId;
  } else {
    return Promise.reject(new MaasError('Missing leg input'));
  }

  return Promise.all([
    lib.fetchCustomerProfile(event.identityId), // Get customer information
    lib.validateSignatures(event), // Validate request signature
  ]).spread((profile, validatedInput)  => {

    const customer = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
    };
    const booking = {
      bookingId: maasUtils.createId(),
      state: 'NEW',
      leg: validatedInput.leg,
      customer: customer,
      term: validatedInput.term,
      meta: validatedInput.meta,
      signature: validatedInput.signature,
    };
    booking.leg.id = maasUtils.createId();
    return [lib.findAgency(agencyId), Promise.resolve(booking)];
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
    transformedBooking = lib.removeSignatures(transformedBooking);
    return saveBooking(transformedBooking);
  });
}

module.exports.respond = (event, callback) => {

  return lib.initKnex()
    .then(_knex => {
      knex = _knex;
      return createBooking(event);
    })
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    })
    .finally(() => {
      if (knex) {
        knex.destroy();
      }
    });
};
