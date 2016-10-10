'use strict';

const Model = require('objection').Model;
const Booking = require('./Booking');

class Leg extends Model {
  $formatDatabaseJson(_json) {
    const json = super.$formatDatabaseJson(_json);

      // Map UTC milliseconds to timestamp format
    if (_json.startTime) {
      json.startTime = new Date(_json.startTime).toISOString();
    }
    if (_json.endTime) {
      json.endTime = new Date(_json.endTime).toISOString();
    }

    return json;
  }

  $parseDatabaseJson(_json) {
    const json = super.$parseDatabaseJson(_json);

      // Map UTC milliseconds to timestamp format
    json.startTime = new Date(_json.startTime).valueOf();
    json.endTime = new Date(_json.endTime).valueOf();

    return json;
  }

  static get tableName() {
    return 'Leg';
  }

  static get relationMappings() {
    return {
      booking: {
        relation: Model.BelongsToOneRelation,
        modelClass: Booking,
        join: {
          from: 'Leg.bookingId',
          to: 'Booking.id',
        },
      },
    };
  }
}

module.exports = Leg;
