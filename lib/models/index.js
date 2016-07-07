'use strict';

const Promise = require('bluebird');
const Model = require('objection').Model;
const knexFactory = require('knex');

// Require postgres, so that it will be bundled
// eslint-disable-next-line no-unused-vars
const pg = require('pg');

// Static class for connection pooling etc.
class Database {
  static init() {
    // In case init has been done already, don't redo it
    if (Database._knex) {
      return Promise.resolve(Database._knex);
    }

    const connection = {
      host: process.env.MAAS_PGHOST,
      user: process.env.MAAS_PGUSER,
      password: process.env.MAAS_PGPASSWORD,
      database: process.env.MAAS_PGDATABASE,
    };
    const config = {
      debug: process.env.KNEX_DEBUG === 'true',
      client: 'pg',
      acquireConnectionTimeout: 5000,
      connection: connection,
      pool: {
        min: 1,
        max: 1,
      },
    };

    Database._knex = knexFactory(config);
    Model.knex(Database._knex);

    return Promise.resolve(Database._knex);
  }

  static cleanup() {
    if (!Database._knex) {
      return Promise.resolve();
    }

    // Return promise
    return Database._knex.destroy()
      .then(() => delete Database._knex);
  }

  static get knex() {
    if (!Database._knex) {
      throw new Error('Knex was requested before init() was called');
    }

    return Database._knex;
  }
}

// FIXME Init needs to be called before extending Models
Database.init();

class Booking extends Model {
  static get tableName() {
    return 'Booking';
  }
}

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

class Itinerary extends Model {
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
    return 'Itinerary';
  }

  static get relationMappings() {
    return {
      legs: {
        relation: Model.HasManyRelation,
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
  Database: Database,
  Itinerary: Itinerary,
  Leg: Leg,
  Booking: Booking,
};
