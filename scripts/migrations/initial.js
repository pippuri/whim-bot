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
      table.string('tspId').index();

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
      table.bigIncrements('id').primary();
      table.string('tableName');
      table.uuid('itemId').notNullable();
      table.string('oldState').notNullable();
      table.string('newState').notNullable();
      table.timestamp('created').notNullable();
    })
    // Import uuid generation extension
    // .raw('CREATE extension "uuid-ossp"')
    // Update modified timestamp procedure
    .raw(`
      CREATE OR REPLACE FUNCTION proc_update_modified_timestamp()
      RETURNS trigger AS
      $modified_timestamp$
        BEGIN
          NEW.modified = now();
          RETURN NEW;
        END;
      $modified_timestamp$ LANGUAGE plpgsql;
    `)
    // State change logging procedure
    .raw(`
      CREATE OR REPLACE FUNCTION proc_log_state_change()
      RETURNS trigger AS
      $state_audit$
        BEGIN
          INSERT INTO "StateLog" ("tableName", "itemId", "oldState", "newState", "created")
            VALUES (TG_TABLE_NAME, OLD.id, OLD.state, NEW.state, now());
          RETURN NULL;
        END;
      $state_audit$ LANGUAGE plpgsql;
    `)
    // Trigger for "modified timestamp" on Booking, Itinerary and Leg
    .raw(`
      CREATE TRIGGER "trig_update_modified_timestamp" BEFORE UPDATE
      ON "Booking"
      FOR EACH ROW EXECUTE PROCEDURE proc_update_modified_timestamp();
    `)
    .raw(`
      CREATE TRIGGER "trig_update_modified_timestamp" BEFORE UPDATE
      ON "Itinerary"
      FOR EACH ROW EXECUTE PROCEDURE proc_update_modified_timestamp();
    `)
    .raw(`
      CREATE TRIGGER "trig_update_modified_timestamp" BEFORE UPDATE
      ON "Leg"
      FOR EACH ROW EXECUTE PROCEDURE proc_update_modified_timestamp();
    `)
    // Trigger for logging states
    .raw(`
      CREATE TRIGGER "trig_log_state_change" BEFORE UPDATE OF "state"
      ON "Booking"
      FOR EACH ROW EXECUTE PROCEDURE proc_log_state_change();
    `)
    .raw(`
      CREATE TRIGGER "trig_log_state_change" BEFORE UPDATE OF "state"
      ON "Itinerary"
      FOR EACH ROW EXECUTE PROCEDURE proc_log_state_change();
    `)
    .raw(`
      CREATE TRIGGER "trig_log_state_change" BEFORE UPDATE OF "state"
      ON "Leg"
      FOR EACH ROW EXECUTE PROCEDURE proc_log_state_change();
    `);
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('Leg')
    .dropTableIfExists('Itinerary')
    .dropTableIfExists('Booking')
    .dropTableIfExists('StateLog');
};
