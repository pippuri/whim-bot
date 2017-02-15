'use strict';

const Booking = require('../../lib/business-objects/Booking');
const Database = require('../../lib/models/Database');
const MaaSError = require('../../lib/errors/MaaSError');
const Transaction  = require('../../lib/business-objects/Transaction');
const utils = require('../../lib/utils');

/**
 * Validate event input
 *
 * @param  {object} event with a identityId and bookingId
 * @return {Promise} undefined in case of success, MaaSError otherwise
 */
function validateInput(event) {
  // Require identityId and phone in input user profile
  if (!event.identityId || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId', 400));
  }

  if (typeof event.bookingId !== 'string') {
    return Promise.reject(new MaaSError('Missing or invalid booking id', 400));
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

  return {
    booking: trimmed,
    maas: {},
  };
}

module.exports.respond = (event, callback) => {

  const transaction = new Transaction(event.identityId);

  return validateInput(event)
    .then(() => Database.init())
    .then(() => transaction.start())
    .then(() => Booking.retrieve(event.bookingId, transaction))
    .then(booking => booking.validateOwnership(event.identityId))
    .then(booking => booking.cancel(transaction))
    .then(bookingInstance => {
      const booking = bookingInstance.toObject();
      return transaction.commit(`Cancelled reservation for a ${booking.leg.mode}`)
        .then(() => Promise.resolve(booking));
    })
    .then(
      booking => Database.cleanup().then(() => formatResponse(booking)),
      error => {
        return transaction.rollback()
          .then(() => Database.cleanup())
          .then(() => Promise.reject(error));
      }
    )
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
