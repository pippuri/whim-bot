'use strict';

const bookingProvidersDump = require('./20161011124208_split-provider-table/BookingProvider.json');
const routesProvidersDump = require('./20161011124208_split-provider-table/RoutesProvider.json');

exports.up = function (knex, Promise) {
  return knex.schema
    .table('BookingProvider', table => {
      table.dropColumn('providerType');
      table.string('region').notNullable();
      table.string('ticketName').notNullable();
      table.specificType('aliases', 'varchar(255)[]').defaultTo('{}').notNullable();
    })
    .table('RoutesProvider', table => {
      table.dropColumn('modes');
    })
    .table('RoutesProvider', table => {
      table.string('region').notNullable();
      table.specificType('modes', 'varchar(255)[]').defaultTo('{}').notNullable();
    })
    .raw(`
      ALTER TABLE "BookingProvider"
      DROP CONSTRAINT IF EXISTS enforce_geotype_geom;
    `)
    .raw(`
      ALTER TABLE "RoutesProvider"
      DROP CONSTRAINT IF EXISTS enforce_geotype_geom;
    `)
    .then(() => {
      return knex.insert(bookingProvidersDump).into('BookingProvider');
    })
    .then(() => {
      return knex.insert(routesProvidersDump).into('RoutesProvider');
    });
};

exports.down = function (knex, Promise) {
  return knex.schema
    .raw(`
      DELETE FROM "BookingProvider"
    `)
    .raw(`
      DELETE FROM "RoutesProvider"
    `)
    .table('BookingProvider', table => {
      table.dropColumn('aliases');
      table.dropColumn('ticketName');
      table.dropColumn('region');
      table.specificType('providerType', 'varchar(50)');
    })
    .table('RoutesProvider', table => {
      table.dropColumn('region');
      table.dropColumn('modes');
    })
    .table('RoutesProvider', table => {
      table.specificType('modes', 'varchar(15)[]').notNullable();
    })
    .raw(`
      ALTER TABLE "BookingProvider"
      ADD CONSTRAINT enforce_geotype_geom CHECK (geometrytype(the_geom) = 'POLYGON'::text OR the_geom IS NULL);
    `)
    .raw(`
      ALTER TABLE "RoutesProvider"
      ADD CONSTRAINT enforce_geotype_geom CHECK (geometrytype(the_geom) = 'POLYGON'::text OR the_geom IS NULL);
    `);
};
