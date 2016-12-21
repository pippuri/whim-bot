'use strict';

exports.up = function (knex, _Promise) {
  return knex.schema.table('Leg', table => {
    table.jsonb('products');
  });
};

exports.down = function (knex, _Promise) {
  return knex.schema.table('Leg', table => {
    table.dropColumn('products');
  });
};
