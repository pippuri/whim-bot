'use strict';

exports.up = function (knex) {
  return knex.schema.table('Booking', table => {
    table.jsonb('fare');
    table.jsonb('cost');
  });
};

exports.down = function (knex) {
  return knex.schema.table('Booking', table => {
    table.dropColumn('fare');
    table.dropColumn('cost');
  });
};
