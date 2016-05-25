'use strict';

const Model = require('objection').Model;

class Booking extends Model {
  static get tableName() {
    return 'Booking';
  }
}

class Leg extends Model {
  $formatDatabaseJson(_json) {
    let json = super.$formatDatabaseJson(_json);

    // Map UTC milliseconds to timestamp format
    json.startTime = new Date(_json.startTime).toISOString();
    json.endTime = new Date(_json.endTime).toISOString();

    return json;
  }

  $parseDatabaseJson(_json) {
    let json = super.$parseDatabaseJson(_json);

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
          from: 'Leg.id',
          to: 'Booking.legId',
        },
      },
    };
  }
}

class Itinerary extends Model {
  $formatDatabaseJson(_json) {
    let json = super.$formatDatabaseJson(_json);

    // Map UTC milliseconds to timestamp format
    json.startTime = new Date(_json.startTime).toISOString();
    json.endTime = new Date(_json.endTime).toISOString();

    return json;
  }

  $parseDatabaseJson(_json) {
    let json = super.$parseDatabaseJson(_json);

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
