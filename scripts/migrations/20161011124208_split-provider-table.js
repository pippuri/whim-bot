'use strict';

const bookingProvidersDump = require('./BookingProviderDumpOct25.json');
const routesProvidersDump = require('./RoutesProviderDumpOct25.json');

exports.up = function (knex, Promise) {
  return knex.schema
    .table('BookingProvider', table => {
      table.dropColumn('providerType');
      table.string('region');
      table.string('ticketName');
      table.specificType('aliases', 'varchar(50)[]').defaultTo('{}');
    })
    .table('RoutesProvider', table => {
      table.string('region');
    })
    .raw(`
      ALTER TABLE "BookingProvider"
      DROP CONSTRAINT IF EXISTS enforce_geotype_geom;
    `)
    .raw(`
      INSERT INTO "BookingProvider"
      SELECT * FROM json_populate_recordset(NULL::"BookingProvider", '${JSON.stringify(bookingProvidersDump)}')
    `)
    .raw(`
      ALTER TABLE "RoutesProvider"
      DROP CONSTRAINT IF EXISTS enforce_geotype_geom;
    `)
    .raw(`
      INSERT INTO "RoutesProvider"
      SELECT * FROM json_populate_recordset(NULL::"RoutesProvider", '${JSON.stringify(routesProvidersDump)}')
    `);
};

exports.down = function (knex, Promise) {
  return knex.schema
    .raw(`
      ALTER TABLE "RoutesProvider"
      CONSTRAINT enforce_geotype_geom CHECK (geometrytype(the_geom) = 'POLYGON'::text OR the_geom IS NULL)
    `)
    .raw(`
      ALTER TABLE "BookingProvider"
      CONSTRAINT enforce_geotype_geom CHECK (geometrytype(the_geom) = 'POLYGON'::text OR the_geom IS NULL)
    `)
    .table('RoutesProvider', table => {
      table.dropColumn('region');
    })
    .table('BookingProvider', table => {
      table.dropColumn('aliases');
      table.dropColumn('ticket');
      table.dropColumn('region');
      table.specificType('providerType', 'varchar(50)').notNullable();
    });
};
