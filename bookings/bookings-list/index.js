'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const models = require('../../lib/models');
const Database = models.Database;

module.exports.respond = (event, callback) => {
  if (!event.hasOwnProperty('identityId') || event.identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId input', 400));
  }

  return Database.knex.select().from('Booking')
    // TODO: add index CREATE INDEX ON Booking((customer->>'id'));
    .whereRaw("customer ->> 'id' > ?", event.identityId)
    .then( response => {
      Database.cleanup()
        .then(() => callback(null, { bookings: response || [] } ));
    } )
    .catch( error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      Database.cleanup()
        .then(() => {
          if (error instanceof MaaSError) {
            callback(error);
            return;
          }
          callback(new MaaSError(`Internal server error: ${error.toString()}`, 500));
        });
    });
};
