'use strict';

const initDataset = require('./20170126151246_geometry-table/geometry_init_dataset.json');

exports.up = function (knex, Promise) {
  return knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    .then(() => knex.schema.createTable('Geometry', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.specificType('regions', 'varchar(30)[]').notNullable().defaultTo('{}'); // Mostly serve as a description
      table.specificType('the_geom', 'geometry').notNullable();
      table.timestamp('created').notNullable().defaultTo(knex.fn.now());
      table.timestamp('modified').defaultTo(knex.fn.now());
    })
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
    .raw(`
      CREATE TRIGGER "trig_update_modified_timestamp" BEFORE UPDATE
      ON "Geometry"
      FOR EACH ROW EXECUTE PROCEDURE proc_update_modified_timestamp();
    `))
    .then(() => knex.insert(initDataset).into('Geometry'));
};

exports.down = function (knex, Promise) {
  return knex.raw('DROP TRIGGER IF EXISTS "trig_update_modified_timestamp" ON "Leg"')
    .then(() => knex.schema.dropTableIfExists('Geometry'))
    .then(() => knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"'));
};
