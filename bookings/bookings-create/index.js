'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const utils = require('../../lib/utils');
const Database = models.Database;
const Booking = require('../../lib/business-objects/Booking');

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
  let booking;
  return Database.init()
    .then(() => {
      booking = Booking.create(event.payload, event.identityId);
    })
    .then(() => booking.pay())
    .then(() => formatResponse(booking.toJSON()))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

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
