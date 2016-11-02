'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const utils = require('../../lib/utils');
const Database = models.Database;
const Booking = require('../../lib/business-objects/Booking');

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

  return Database.init()
    .then(() => validateInput(event))
    .then(() => Booking.retrieve(event.bookingId))
    .then(booking => booking.validateOwnership(event.identityId))
    .then(booking => booking.cancel())
    .then(booking => formatResponse(booking.toObject()))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      console.warn(_error.stack);

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
