'use strict';

const Booking = require('../../lib/business-objects/Booking');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Promise = require('bluebird');
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

  return Promise.resolve({
    booking: trimmed,
    maas: {},
  });
}

module.exports.respond = (event, callback) => {

  const transaction = new Transaction();

  return validateInput(event)
    .then(() => models.Database.init())
    .then(() => Booking.retrieve(event.bookingId))
    .then(booking => booking.validateOwnership(event.identityId))
    .then(booking => {
      return transaction.start()
        .then(() => transaction.bind(models.Booking))
        .then(() => transaction.meta(models.Booking.tableName, booking.id))
        .then(() => Promise.resolve(booking));
    })
    .then(booking => booking.cancel(transaction))
    .then(bookingInstance => {
      const booking = bookingInstance.toObject();
      const message = `Cancelled reservation for a ${booking.leg.mode}`;

      return transaction.commit(message, event.identityId, booking.fare.amount)
        .then(() => Promise.resolve(booking));
    })
    .then(booking => formatResponse(booking))
    .then(response => {
      models.Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn(`This event caused error: ${JSON.stringify(event, null, 2)}`);
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
