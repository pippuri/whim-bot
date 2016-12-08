'use strict';
const sixtWhimcar = require('./20161205133846_Add-Sixt-Whim-car/BookingProviderSixtWhimcar.json');

exports.up = function (knex, Promise) {
  return knex.insert(sixtWhimcar).into('BookingProvider');
};

exports.down = function (knex, Promise) {
  return knex('BookingProvider')
      .where('agencyId', 'Sixt-Whim-car')
      .del();
};
