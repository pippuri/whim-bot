'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const signatures = require('../../lib/signatures');
const utils = require('../../lib/utils');

const Transaction = require('../../lib/business-objects/Transaction');
const Booking = require('../../lib/business-objects/Booking');

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
 * Formats the response by removing JSON nulls
 *
 * @param {object} booking The unformatted response object
 * @return {object} A valid MaaS Response nesting the object & meta
 */
function formatResponse(booking) {
  const trimmed = utils.sanitize(booking);

  return Promise.resolve({
    booking: trimmed,
    maas: {},
  });
}

/**
 * serverless handler
 * @param  {Object}   event
 * @param  {Function} callback
 * @return {Promise -> [undefined,undefined]}
 */
module.exports.respond = (event, callback) => {

  const transaction = new Transaction(event.identityId);

  return validateInput(event)
    .then(() => signatures.validateSignatures(event.payload))
    .then(signedBooking => utils.without(signedBooking, ['signature']))
    .then(unsignedBooking => models.Database.init().then(() => Promise.resolve(unsignedBooking)))
    .then(unsignedBooking => {
      return transaction.start()
        .then(() => Booking.create(unsignedBooking, event.identityId, transaction, { skipInsert: false }))
        .then(newBooking => newBooking.pay(transaction))
        .then(paidBooking => {
          transaction.meta(models.Booking.tableName, paidBooking.booking.id);
          return Promise.resolve(paidBooking);
        })
        .then(paidBooking => {
          const bookingData = paidBooking.toObject();
          // Prevent faulty negative point in booking fare as all booking must cost more or equal to 0
          if (bookingData.fare.amount < 0) {
            return transaction.rollback()
              .then(() => Promise.reject(new MaaSError('Faulty new booking, fare is smaller than 0', 500)));
          }
          return paidBooking.reserve(transaction)
            .then(() => transaction.commit(`Reserve ticket for a ${bookingData.leg.mode}`))
            .then(() => Promise.resolve(paidBooking));
        })
        .then(booking => formatResponse(booking.toObject()))
        .then(bookingData => {
          models.Database.cleanup()
            .then(() => {
              callback(null, bookingData);
            });
        });
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      return transaction.rollback()
        .then(() => models.Database.cleanup())
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
