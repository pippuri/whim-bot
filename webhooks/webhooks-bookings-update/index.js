'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const Booking = require('../../lib/business-objects/Booking');
const models = require('../../lib/models/');
const Database = models.Database;

// TODO request schemas validation
function validateInput(event) {
  if (!event.agencyId) {
    return Promise.reject(new MaaSError('Missing agencyId in input', 400));
  }

  if (!event.payload || Object.keys(event.payload).length === 0) {
    return Promise.reject(new MaaSError('Missing or empty payload', 400));
  }

  if (!event.payload.tspId) {
    return Promise.reject(new MaaSError('Missing tspId in payload', 400));
  }

  return Promise.resolve();
}

module.exports.respond = (event, callback) => {
  return validateInput(event)
    .then(() => Database.init())
    .then(() => Booking.webhookCallback(event.agencyId, event.tspId, event.payload))
    .then(updatedBooking => callback(null, updatedBooking))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
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
