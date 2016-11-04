'use strict';

const models = require('../../lib/models');
const Database = models.Database;
const BookingProvider = models.BookingProvider;
const RoutesProvider = models.RoutesProvider;

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
      ALTER TABLE "RoutesProvider"
      DROP CONSTRAINT IF EXISTS enforce_geotype_geom;
    `)
    .then(() => {
      Database.init()
        .then(() => {
          return BookingProvider.query().insert(bookingProvidersDump);
        })
        .then(() => {
          return RoutesProvider.query().insert(routesProvidersDump);
        })
        .then(() => {
          return Database.cleanup()
            .then(() => {
              console.log('Successfully plant seed data to BookingProvider and RoutesProvider');
              return Promise.resolve();
            });
        })
        .catch(error => {
          console.log(error);
          return Database.cleanup()
            .then( _ => {
              console.log('Failed to Dump data to Postgre!');
              return Promise.reject(error);
            });
        });
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
    .table('RoutesProvider', table => {
      table.dropColumn('region');
    })
    .table('BookingProvider', table => {
      table.dropColumn('aliases');
      table.dropColumn('ticketName');
      table.dropColumn('region');
      table.specificType('providerType', 'varchar(50)');
    });
};
