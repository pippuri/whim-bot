'use strict';

const bookingProvidersDump = require('./20170124195613_new-geometry-and-VP-taxi-only/BookingProvider.json');
const routesProvidersDump = require('./20170124195613_new-geometry-and-VP-taxi-only/RoutesProvider.json');
const bookingProvidersBackup = require('./20170124195613_new-geometry-and-VP-taxi-only/BookingProvider-backup.json');
const routesProvidersBackup = require('./20170124195613_new-geometry-and-VP-taxi-only/RoutesProvider-backup.json');


exports.up = function (knex, Promise) {
  return knex('BookingProvider').del()
    .then(() => knex('RoutesProvider').del())
    .then(() => knex.insert(bookingProvidersDump).into('BookingProvider'))
    .then(() => knex.insert(routesProvidersDump).into('RoutesProvider'));

};

exports.down = function (knex, Promise) {
  return knex('BookingProvider').del()
    .then(() => knex('RoutesProvider').del())
    .then(() => knex.insert(bookingProvidersBackup).into('BookingProvider'))
    .then(() => knex.insert(routesProvidersBackup).into('RoutesProvider'));
};
