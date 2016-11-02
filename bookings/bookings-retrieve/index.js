'use strict';

//const _ = require('lodash');
const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const utils = require('../../lib/utils');
const Database = models.Database;
const Booking = require('../../lib/business-objects/Booking');

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
  return Database.init()
    .then(() => validateInput(event))
    .then(() => Booking.retrieve(event.bookingId))
    .then(booking => booking.validateOwnership(event.identityId))
    .then(booking => {
      if (event.refresh && event.refresh === 'true' || event.refresh === true) {
        return booking.refresh();
      }
      return Promise.resolve(booking);
    })
    .then(booking => formatResponse(booking.toObject()))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      // Uncaught, unexpected error
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
