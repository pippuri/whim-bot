'use strict';


exports.up = function (knex) {
  return knex.schema
    .table('Profile', table => {
      table.jsonb('paymentMethod')
           .notNullable()
           .defaultsTo(knex.raw('\'{}\'::JSONB'));
    });
};

exports.down = function (knex) {
  return knex.schema
    .table('Profile', table => {
      table.dropColumn('paymentMethod');
    });
};
