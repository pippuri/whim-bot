'use strict';

const Promise = require('bluebird');
const Model = require('objection').Model;
const knexFactory = require('knex');

// Require postgres, so that it will be bundled
// eslint-disable-next-line no-unused-vars
const pg = require('pg');

// Static class for connection pooling etc.
class Database {

  /**
   * Initialises the database and returns one handle to knex
   * Note: The class maintains a reference counter, which is updated on every init.
   * The database is not initialised again on subsequent call - the reference counter
   * is just updated.
   *
   * @return {object} a Knex handle that may or may not be used
   */
  static init() {
    // Update reference handle count
    Database._handleCount++;

    // In case init has been done already, don't redo it
    if (Database._handleCount > 1) {
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

  /**
   * Cleanups the database or releases one handle to the DB
   * Note: In case of init() called multiple times, this just reduces the
   * reference count. The database is only shutdown when the handles go to 0.
   *
   * @param {boolean} force Forcefully cleanup all remaining handles
   * @return {Promise} resolves to undefined, or rejects with Error if no handles left
   */
  static cleanup(force) {
    if (Database._handleCount === 0) {
      const message = 'Database already closed, cannot cleanup';
      return Promise.reject(new Error(message));
    }

    // Update reference handle count
    Database._handleCount--;

    // Don't do anything if the reference count is above 0
    if (Database._handleCount > 0 && !force) {
      return Promise.resolve();
    }

    // Last reference count - shutdown the DB and reset the handle count
    return Database._knex.destroy()
      .then(() => {
        delete Database._knex;
        Database._handleCount = 0;
      });
  }

  static get knex() {
    if (!Database._knex) {
      throw new Error('A handle to Knex was requested before init() was called');
    }

    return Database._knex;
  }

  static get handleCount() {
    return Database._handleCount;
  }
}

// A reference count field that tracks the # of inits to match # of cleanups;
// Needed for the case delaying closing the driver until all inits have cleaned up.
Database._handleCount = 0;

class Booking extends Model {
  static get tableName() {
    return 'Booking';
  }
}

class TicketPartner extends Model {
  static get tableName() {
    return 'TicketPartner';
  }
}

class TicketAuditLog extends Model {
  static get tableName() {
    return 'TicketAuditLog';
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
  TicketPartner: TicketPartner,
  TicketAuditLog: TicketAuditLog,
};
