'use strict';

const Database = require('../../lib/models').Database;
const tsp = require('../../lib/tsp/index');
const _ = require('lodash');

module.exports.respond = (event, callback) => {

  let storedBooking;
  return Database.init()
    .then(() => {
      return models.Booking
      .query()
      .findById(event.bookingId);
    })
    .then(booking => {
      if (!booking) {
        return Promise.reject(new Error('No booking found with bookingId'));
      }
      storedBooking = booking;
      return tsp.retrieveBooking(booking.tspId, booking.leg.agencyId);
    })
    .then(tspBooking => {
      const updatedBooking = _.merge({}, storedBooking, tspBooking);

      // TODO Verify that the data we have received is still valid
      return models.Booking
        .query()
        .updateAndFetchById(storedBooking.id, updatedBooking);
    })
    .then(response => callback(null, response))
    .catch(error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    })
    .finally(() => {
      if (knex) {
        knex.destroy();
      }
    });
};
