'use strict';

exports.up = function (knex, Promise) {
  return Promise.all([
    knex('BookingProvider')
      .where('gid', 15)
      .update({
        ticketName: 'Espoo',
      }),
    knex('BookingProvider')
      .where('gid', 18)
      .update({
        ticketName: 'Kerava-Sipoo',
      }),
    knex('BookingProvider')
      .where('gid', 20)
      .update({
        ticketName: 'Lähiseutu 2',
      }),
    knex('BookingProvider')
      .where('gid', 21)
      .update({
        ticketName: 'Lähiseutu 3',
      }),
  ]);
};

exports.down = function (knex, Promise) {
  return Promise.all([
    knex('BookingProvider')
      .where('gid', 15)
      .update({
        ticketName: 'Espoo-Kauniainen',
      }),
    knex('BookingProvider')
      .where('gid', 18)
      .update({
        ticketName: 'Sipoo-Kerava',
      }),
    knex('BookingProvider')
      .where('gid', 20)
      .update({
        ticketName: 'Lähiseutu-2',
      }),
    knex('BookingProvider')
      .where('gid', 21)
      .update({
        ticketName: 'Lähiseutu-3',
      }),
  ]);
};
