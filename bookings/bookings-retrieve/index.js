'use strict';

//const _ = require('lodash');
const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
//const tsp = require('../../lib/tsp');
const Database = models.Database;

module.exports.respond = (event, callback) => {

  return Promise.resolve(Database.init())
    .then(() => models.Booking.query().findById(event.bookingId))
    // TODO: This merging business should be done in an another endpoint which we don't have yet
    /*
    .then(booking => {
      if (!booking) {
        const message = `No booking found with bookingId '${event.bookingId}'`;
        return Promise.reject(new MaaSError(message, 404));
      }

      return Promise.all([
        tsp.retrieveBooking(booking.tspId, booking.leg.agencyId),
        booking,
      ]);
    })
    .spread((tspBooking, booking) => {
      const updatedBooking = _.merge({}, booking, tspBooking);

      // TODO Verify that the data we have received is still valid
      return models.Booking.query()
        .updateAndFetchById(booking.id, updatedBooking);
    })
    */
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

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
