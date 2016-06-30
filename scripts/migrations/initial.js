'use strict';

exports.up = function (knex) {
  return knex.schema
    .createTable('Itinerary', table => {
      table.uuid('id').primary();
      table.string('identityId').index().notNullable();
      table.string('state');

      // OTP specific
      table.timestamp('startTime').index();
      table.timestamp('endTime');
      table.jsonb('fare');

      // Extra
      table.timestamp('created').notNullable().defaultTo(knex.raw('now()'));
      table.timestamp('modified');
    })
    .createTable('Booking', table => {
      table.uuid('id').primary();

      // TSP generated foreign key (primary from their viewpoint)
      table.string('tspId').index().notNullable();

      // TODO Find alter tabel syntax where to create the leg reference
      //table.uuid('legId').references('Leg.id');

      table.string('state');
      table.jsonb('leg');
      table.jsonb('customer');
      table.jsonb('token');
      table.jsonb('terms');
      table.jsonb('meta');

      // Extra
      table.timestamp('created').notNullable().defaultTo(knex.raw('now()'));
      table.timestamp('modified');
    })
    .raw(`
      CREATE OR REPLACE FUNCTION proc_update_timestamp()
      RETURNS trigger AS
      $Booking$
        BEGIN
          NEW.modified = now();
          RETURN NEW;
        END;
      $Booking$ LANGUAGE plpgsql;
    `)
    .raw(`
      CREATE TRIGGER "trig_update_timestamp" AFTER UPDATE OR INSERT
      ON "Booking"
      FOR EACH ROW EXECUTE PROCEDURE proc_update_timestamp();
    `)
    .createTable('Leg', table => {
      table.uuid('id').primary();
      table.uuid('itineraryId').references('Itinerary.id');
      table.uuid('bookingId').references('Booking.id');
      table.string('state');

      // OTP specific
      table.jsonb('from');
      table.jsonb('to');
      table.timestamp('startTime');
      table.timestamp('endTime');
      table.string('mode');
      table.integer('departureDelay');
      table.integer('arrivalDelay');
      table.decimal('distance');
      table.jsonb('fare');
      table.string('route');
      table.string('routeShortName');
      table.string('routeLongName');
      table.string('agencyId');
      table.jsonb('legGeometry');

      // Extra
      table.timestamp('created').notNullable().defaultTo(knex.raw('now()'));
      table.timestamp('modified');
    })
    .createTable('StateLog', table => {
      table.uuid('id').primary();
      table.string('tableName');
      table.uuid('itemId').notNullable();
      table.string('oldState').notNullable();
      table.string('newState').notNullable();
      table.timestamp('created').notNullable();
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('Leg')
    .dropTableIfExists('Itinerary')
    .dropTableIfExists('Booking')
    .dropTableIfExists('StateLog');
};
