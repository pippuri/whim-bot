'use strict';

//const _ = require('lodash');
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
  const trimmed = utils.removeNulls(booking.toObject());

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
  return Database.init()
    .then(() => Booking.retrieve(event.bookingId))
    .then(booking => booking.validateOwnership(event.identityId))
    .then(booking => {
      let reply;
      if (event.refresh && event.refresh === 'true' || event.refresh === true) {
        reply = booking.refresh();
      } else {
        reply = Promise.resolve(booking);
      }
      return reply;
    })
    .then(booking => formatResponse(booking))
    .then(bookingJSON => {
      Database.cleanup()
        .then(() => callback(null, bookingJSON));
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

