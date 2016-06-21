'use strict';

const Promise = require('bluebird');
const maasUtils = require('../../lib/utils');
const request = require('request-promise-lite');
const MaasError = require('../../lib/errors/MaaSError');
const lib = require('../lib/index');

/**
 * Save booking to Postgre
 */
function saveBooking(booking) {
  const knex = lib.initKnex();

  return knex
    .insert(booking)
    .into('Booking')
    .finally(() => {
      if (knex) {
        knex.destroy();
      }
    });
}

/**
 * Create a booking for a leg OR an individual booking ( Go on a whim)
 */
function createBooking(event) {

  let agencyId;
  let leg;

  // Require identityId and phone in input user profile
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaasError('Missing identityId', 400));
  }

  if (!event.hasOwnProperty('signature') || event.signature === '') {
    return Promise.reject(new MaasError('Missing signature', 400));
  }

  if (event.hasOwnProperty('leg') && Object.keys(event.leg).length !== 0 && event.leg.hasOwnProperty('agencyId') && event.leg.agencyId !== '') {
    leg = event.leg;
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
      console.log(booking);

      // TODO delegate this to maas tsp functions
      const url = tsp.adapter.baseUrl + tsp.adapter.endpoints.post.book;
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.options);

      console.log('url ', url);
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
      return saveBooking(transformedBooking)
        .then(knexResponse => {
          return transformedBooking;
        });
    });
}

module.exports.respond = (event, callback) => {

  return createBooking(event)
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
