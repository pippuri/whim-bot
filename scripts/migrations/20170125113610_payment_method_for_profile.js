'use strict';


exports.up = function (knex) {
  return knex.schema
    .table('Profile', table => {
      table
        .jsonb('paymentMethod')
        .notNullable()
        .defaultsTo(knex.raw('\'{"type":"unknown", "valid":false}\'::JSONB'));
    })
    .then(() => {
      // Update current users to set the valid flag for backwards compatability
      return knex('Profile')
        .update({
          paymentMethod: '{ "type":"unknown", "valid":true }',
        });
    });
};

exports.down = function (knex) {
  return knex.schema
    .table('Profile', table => {
      table.dropColumn('paymentMethod');
    });
};
