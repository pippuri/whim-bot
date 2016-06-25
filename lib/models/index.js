'use strict';

const URL = require('url');
const Model = require('objection').Model;
const knexFactory = require('knex');
const objection = require('objection');

// Require postgres, so that it will be bundled
// eslint-disable-next-line no-unused-vars
const pg = require('pg');

function init() {
  //console.log('Initialize knex');

  // FIXME Change variable names to something that tells about MaaS in general
  const connection = URL.format({
    protocol: 'postgres:',
    slashes: true,
    hostname: process.env.MAAS_PGHOST,
    port: process.env.MAAS_PGPORT,
    auth: process.env.MAAS_PGUSER + ':' + process.env.MAAS_PGPASSWORD,
    pathname: '/' + process.env.MAAS_PGDATABASE,
  });
  const config = {
    client: 'postgresql',
    connection: connection,
  };

  const knex = knexFactory(config);
  objection.Model.knex(knex);

  return knex;
}

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
  init: init,
  Itinerary: Itinerary,
  Leg: Leg,
  Booking: Booking,
};
