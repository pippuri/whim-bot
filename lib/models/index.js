// jshint -W034
// Node needs the declaration to permit usage of 'let' */
'use strict';

const Model = require('objection').Model;

class Booking extends Model {
  static get tableName() {
    return 'Booking';
  }
}

class Leg extends Model {
  $formatDatabaseJson(_json) {
    const json = super.$formatDatabaseJson(_json);

    // Map UTC milliseconds to timestamp format
    json.startTime = new Date(_json.startTime).toISOString();
    json.endTime = new Date(_json.endTime).toISOString();

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
        relation: Model.OneToOneRelation,
        modelClass: Booking,
        join: {
          from: 'Leg.bookingId',
          to: 'Booking.id',
        },
      },
    };
  }
}

class Itinerary extends Model {
  $formatDatabaseJson(_json) {
    const json = super.$formatDatabaseJson(_json);

    // Map UTC milliseconds to timestamp format
    json.startTime = new Date(_json.startTime).toISOString();
    json.endTime = new Date(_json.endTime).toISOString();

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
    return 'Itinerary';
  }

  static get relationMappings() {
    return {
      legs: {
        relation: Model.OneToManyRelation,
        modelClass: Leg,
        join: {
          from: 'Itinerary.id',
          to: 'Leg.itineraryId',
        },
      },
    };
  }
}

module.exports = {
  Itinerary: Itinerary,
  Leg: Leg,
  Booking: Booking,
};