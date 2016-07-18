'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const _ = require('lodash');
const Database = require('../../lib/models/index').Database;

// Allowed data
const allowedFields = ['state', 'token', 'leg'];
const returnField = ['tspId', 'id'];

function updateBooking(event) {
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing or empty identityId', 401));
  }

  if (!event.hasOwnProperty('bookingId') || !event.bookingId.match(/[A-F0-9]{8}(-[A-F0-9]{4}){3}-[A-F0-9]{12}/g)) {
    return Promise.reject(new MaaSError('Missing or invalid bookingId'));
  }

  if (!event.hasOwnProperty('payload') || Object.keys(event.payload).length < 1) {
    return Promise.reject(new MaaSError('Missing or empty payload', 400));
  }

  // Compare input key vs allowed keys
  Object.keys(event.payload).map(key => { // eslint-disable-line consistent-return
    if (!_.includes(allowedFields, key.toLowerCase())) {
      return Promise.reject(new MaaSError(`Request contains unallowed field(s), allow only [${allowedFields}]`));
    }
  });

  const modifiedTime = new Date().getTime();
  event.payload.modified = new Date(modifiedTime).toISOString();

  return Database.knex
    .update(event.payload, returnField.concat(Object.keys(event.payload)))
    .into('Booking')
    .where({
      id: event.bookingId,
    })
    .then(response => {
      if (response.length !== 1) {
        return Promise.reject(new MaaSError(`Database returned ${response.length} results (expected 1) with ${event.bookingId}`, 500));
      }
      const booking = response[0];
      return booking;
    });
}

module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => updateBooking(event))
    .then(response => {
      Database.cleanup()
        .then(() => callback(null, response));
    })
    .catch(_error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));

      // Uncaught, unexpected error
      Database.cleanup()
      .then(() => {
        callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
      });
    });
};