'use strict';

const Promise = require('bluebird');
const lib = require('../lib/index');
const knex = lib.initKnex();
const objection = require('objection');
const request = require('request-promise-lite');
const models = require('../../lib/models');
const tsp = require('../../lib/tsp');
const _ = require('lodash');

module.exports.respond = (event, callback) => {

  let storedBooking;

  return models.Booking
    .query()
    .findById(event.bookingId)
    .then(booking => {
      storedBooking = booking;

      return tsp.retrieveBooking(booking.tspId, booking.leg.agencyId)
    })
    .then(tspBooking => {
      const updatedbooking = _.merge(storedBooking, tspBooking);

      // TODO Verify that the data we have received is still valid
      return models.Booking
        .query()
        .updateAndFetchById(storedBooking.id, updatedBooking);
    })
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
