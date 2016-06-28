'use strict';

const lib = require('../lib/index');
const models = require('../../lib/models');
const tsp = require('../../lib/tsp');
const _ = require('lodash');

// Variable for knex connection
let knex;

module.exports.respond = (event, callback) => {

  let storedBooking;
  return lib.initKnex()
    .then(_knex => {
      knex = _knex;
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
