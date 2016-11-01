'use strict';

const Booking = require('../../lib/business-objects/Booking');
const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const signatures = require('../../lib/signatures');
const utils = require('../../lib/utils');

const Database = models.Database;

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
  const trimmed = utils.removeNulls(booking);

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
  let trx;

  return Database.init()
    .then(() => validateInput(event))
    .then(() => signatures.validateSignatures(event.payload))
    .then(signedBooking => utils.without(signedBooking, ['signature']))
    .then(unsignedBooking => Booking.startTransaction()
      .then(transaction => Promise.resolve(trx = transaction))
      .then(transaction => Booking.create(unsignedBooking, event.identityId, false, transaction)))
    .then(booking => booking.pay(trx))
    .then(booking => trx.commit()
      .then(() => {
        trx = undefined; // prevent rollback from now on
        return Promise.resolve(booking);
      }))
    .then(booking => booking.reserve()) // Not bind to transaction by purpose
    .then(booking => formatResponse(booking.toObject()))
    .then(bookingData => {
      Database.cleanup()
        .then(() => callback(null, bookingData));
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      const rollback = trx ? trx.rollback() : Promise.resolve();
      return rollback
        .then(() => Database.cleanup())
        .then(() => {
          if (_error instanceof MaaSError) {
            callback(_error);
            return;
          }

          callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
        });
    });
};
