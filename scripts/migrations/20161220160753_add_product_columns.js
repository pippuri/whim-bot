'use strict';

exports.up = function (knex, _Promise) {
  return knex.schema
    .table('Leg', table => {
      table.jsonb('product');
    })
    .table('Booking', table => {
      table.jsonb('product');
    });
};

exports.down = function (knex, _Promise) {
  return knex.schema
    .table('Leg', table => {
      table.dropColumn('product');
    })
    .table('Booking', table => {
      table.dropColumn('product');
    });
};
