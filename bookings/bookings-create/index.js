'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const tsp = require('../../lib/tsp');
const stateMachine = require('../../lib/states/index').StateMachine;
const utils = require('../../lib/utils');
const Database = models.Database;
const maasOperation = require('../../lib/maas-operation');

/**
 * Validate event input
 * @param  {object} event
 * @return {Promise -> undefined}
 */
function validateInput(event) {
  // Require identityId and phone in input user profile
  if (!event.identityId || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId', 400));
  }

  if (!event.payload.signature || event.payload.signature === '') {
    return Promise.reject(new MaaSError('Missing signature', 400));
  }

  if (!event.payload.leg) {
    return Promise.reject(new MaaSError('Missing leg input', 400));
  }

  if (!event.payload.leg.agencyId || event.payload.leg.agencyId === '') {
    return Promise.reject(new MaaSError('Missing agencyId in input leg', 400));
  }

  return Promise.resolve();
}

/**
 * Save booking to Postgres
 * @param {object} booking
 * @return {Promise -> object} db save response object
 */
function saveBooking(booking) {
  return models.Booking.query().insert(booking);
}

/**
 * Change booking state and log the state change
 * @param {object} booking
 * @param {string} state
 * @return {Promise -> undefined}
 */
function changeBookingState(booking, state) {
  const old_state = booking.state || 'START';
  booking.state = state;
  return stateMachine.changeState('Booking', booking.id || booking.bookingId, old_state, booking.state)
    .return(booking);
}

/**
 * Create a booking for an individual booking (Go on a whim)
 * @param  {object} event
 * @return {Promise -> object} responseBooking - The booking with the tsp booking status
 */
function createBooking(event) {

  let cachedProfile;
  let oldBalance;
  let calculatedBalance;

  return Promise.all([
    maasOperation.fetchCustomerProfile(event.identityId), // Get customer information
    utils.validateSignatures(event.payload) // Validate request signature
      .then(booking => changeBookingState(booking, 'PENDING')), // Change state to PENDING after validating
  ])
  .spread((profile, pendingBooking)  => {
    cachedProfile = profile;
    oldBalance = profile.balance;

    return maasOperation.computeBalance(pendingBooking.terms.price.amount, cachedProfile)
      .then(_calculatedBalance => {
        calculatedBalance = _calculatedBalance;
        return Promise.all([
          changeBookingState(pendingBooking, 'PAID'),
          maasOperation.updateBalance(event.identityId, calculatedBalance), // Deduction
        ]);
      })
      .spread((paidBooking, updateResponse) => {

        const request = {
          id: utils.createId(),
          leg: paidBooking.leg,
          customer: {
            identityId: cachedProfile.identityId,
            title: cachedProfile.title || 'mr',
            firstName: cachedProfile.firstName || 'John',
            lastName: cachedProfile.lastName || 'Doe',
            phone: cachedProfile.phone,
            email: cachedProfile.email || `maasuser-${profile.phone}@maas.fi`,
          },
          terms: paidBooking.terms,
          meta: paidBooking.meta,
        };

        return tsp.createBooking(request)
          .then(reservedBooking => {
            // responseBooking has state RESERVED here and was already saved
            return changeBookingState(Object.assign(reservedBooking, paidBooking), 'RESERVED');
          })
          .catch(error => {
            if (error) {
              return Promise.reject(error);
            }
            // Inject some missing information, because adapter return error instead of request booking
            paidBooking.customer = request.customer;
            paidBooking.id = request.id;
            paidBooking.tspId = null;

            return Promise.all([
              changeBookingState(paidBooking, 'REJECTED'),
              maasOperation.updateBalance(event.identityId, oldBalance), // Refunding
            ])
            .spread((rejectedBooking, updateResponse) => rejectedBooking);
          });
      });
  })
  .then(responseBooking => {
    return saveBooking(responseBooking)
      .return(responseBooking);
  });
}

/**
 * serverless handler
 * @param  {Object}   event
 * @param  {Function} callback
 * @return {Promise -> [undefined,undefined]}
 */
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
      // console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

      Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(_error);
        });
    });
};
