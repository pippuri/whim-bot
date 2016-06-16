'use strict';

const Promise = require('bluebird');
const maasUtils = require('../../lib/utils');
const tspData = require('../lib/tspData.json');
const request = require('request-promise-lite');
const URL = require('url');
const MaasError = require('../../lib/errors/MaaSError');
const lib = require('../lib/index');
const _  = require('lodash');

/**
 * Find agency by their id
 */
function findAgency(agencyId) {
  const agencyIdList = Object.keys(tspData).map(key => {
    return tspData[key].agencyId;
  });

  if (_.includes(agencyIdList, agencyId)) {
    return Promise.resolve(tspData[agencyId]);
  }

  return Promise.reject('No suitable TSP found with id ' + agencyId);
}

/**
 * Save booking to Postgre
 */
function saveBooking(booking) {
  const knex = lib.initKnex();

  return knex
    .insert(booking)
    .into(process.env.MAAS_PGTABLE_BOOKING)
    .finally(() => {
      if (knex) {
        knex.destroy();
      }
    });
}

/**
 * Create a booking for a leg OR an individual booking ( Go on a whim)
 * If event has leg then create a booking with that leg, if not use the agencyId from event
 */
function createBooking(event) {

  let agencyId;
  let leg;
  let customer;
  let booking;

  // Require identityId and phone in input user profile
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaasError('Missing identityId', 400));
  }

  if (!event.hasOwnProperty('signature') || event.signature === '') {
    return Promise.reject(new MaasError('Missing signature', 400));
  }

  // If event not contain leg, it shoulda has at least agencyId
  if (event.hasOwnProperty('leg') && Object.keys(event.leg).length !== 0 && event.leg.hasOwnProperty('agencyId') && event.leg.agencyId !== '') {
    leg = event.leg;
    agencyId = event.leg.agencyId;
  } else {
    return Promise.reject(new MaasError('Missing leg input'));
  }

  return Promise.all([
      lib.fetchCustomerProfile(event.identityId), // Get customer information
      lib.validateSignatures(event), // Validate request signature
    ])
    .spread((profile, validatedInput)  => {

      customer = {
        firstName: profile.firstName ? profile.firstName : null,
        lastName: profile.lastName ? profile.lastName : null,
        phone: profile.phone,
      };
      booking = {
        bookingId: maasUtils.createId(),
        state: 'NEWs',
        leg: validatedInput.leg,
        customer: customer,
        term: validatedInput.term,
        meta: validatedInput.meta,
        signature: validatedInput.signature,
      };
      booking.leg.id = maasUtils.createId();
      return findAgency(agencyId);
    })
    .then(tsp => {
      // TODO delegate this to maas tsp functions
      const url = URL.resolve(tsp.adapter.baseUrl, 'bookings');
      const options = Object.assign({
        json: true,
        body: booking,
      }, tsp.adapter.options);

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
      return Promise.all([saveBooking(transformedBooking), Promise.resolve(transformedBooking)]);
    });
}

module.exports.respond = (event, callback) => {

  return createBooking(event)
    .spread((knexResponse, transformedBooking) => {
      callback(null, transformedBooking);
    })
    .catch(error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
