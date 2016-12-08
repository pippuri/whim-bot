'use strict';

const Booking = require('../../lib/business-objects/Booking');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Promise = require('bluebird');
const Transaction = require('../../lib/business-objects/Transaction');
const utils = require('../../lib/utils');

/**
 * Validate event input
 *
 * @param  {object} event
 * @return {Promise -> undefined}
 */
function validateInput(event) {
  if (typeof event.identityId !== 'string' || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId', 400));
  }

  if (typeof event.bookingId !== 'string') {
    return Promise.reject(new MaaSError('Missing or invalid booking id', 400));
  }

  const refresh = event.refresh;
  if (refresh !== 'true' && refresh !== 'false' && refresh !== '' && typeof refresh !== 'undefined') {
    return Promise.reject(new MaaSError(`Invalid value for refresh: ${refresh}, should be 'true' or 'false'`, 400));
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

  return models.Database.init()
    .then(() => validateInput(event))
    .then(() => {
      if (event.refresh && event.refresh === 'true' || event.refresh === true) {
        const transaction = new Transaction();

        // Commit the transaction but skip writing to transaction log
        // this does not have anything to do with value, but we want to prevent
        // concurrent writes to bookings.
        return transaction.start()
        .then(() => Booking.retrieve(event.bookingId, transaction))
        .then(booking => booking.validateOwnership(event.identityId))
        .then(booking => booking.refresh(transaction))
        .then(booking => {
          transaction.commit(null, event.identityId);
          return booking;
        })
        .catch(error => {
          transaction.rollback();
          return Promise.reject(error);
        });
      }

      // No refreshing, no transaction needed
      return Booking.retrieve(event.bookingId)
        .then(booking => booking.validateOwnership(event.identityId));
    })
    .then(booking => formatResponse(booking.toObject()))
    .then(response => {
      models.Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      // Uncaught, unexpected error
      models.Database.cleanup()
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
