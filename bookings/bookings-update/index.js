'use strict';

const Promise = require('bluebird');
const lib = require('../lib/index');
const knex = lib.initKnex();
const MaasError = require('../../lib/errors/MaaSError');
const _ = require('lodash');

// Require postgres, so that it will be bundled
// eslint-disable-next-line no-unused-vars
const pg = require('pg');

function updatePostgre(event) {
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaasError('Missing or empty identityId', 401));
  }

  if (!event.hasOwnProperty('bookingId') || !event.bookingId.match(/[A-F0-9]{8}(-[A-F0-9]{4}){3}-[A-F0-9]{12}/g)) {
    return Promise.reject(new MaasError('Missing or invalid bookingId'));
  }

  if (!event.hasOwnProperty('payload') || Object.keys(event.payload).length < 1) {
    return Promise.reject(new MaasError('Missing or empty payload', 400));
  }

  const allowedFields = ['state', 'token', 'leg'];
  const allowedReturn = ['tspId'];

  // Compare input key vs allowed keys
  Object.keys(event.payload).map(key => { // eslint-disable-line consistent-return
    if (!_.includes(allowedFields, key.toLowerCase())) {
      return Promise.reject(new MaasError(`Request contains unallowed field(s), allow only [${allowedFields}]`));
    }
  });

  return knex
    .update(event.payload, allowedReturn.concat(Object.keys(event.payload)))
    .into('Booking')
    .where({
      id: event.bookingId,
    })
    .then(response => {
      if (response.length > 1) {
        return Promise.reject(new MaasError('Database returns more than 1 result, server error', 500));
      }

      const booking = response[0];
      return booking;
    });
}

module.exports.respond = (event, callback) => {
  updatePostgre(event)
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      callback(error);
    })
    .finally(() => {
      if (knex) {
        knex.destroy();
      }
    });
};
