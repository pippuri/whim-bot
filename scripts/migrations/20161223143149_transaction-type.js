'use strict';

exports.up = function (knex, Promise) {
  return knex.schema
    .table('TransactionLog', table => {
      table.string('type');
    });
};

exports.down = function (knex, Promise) {
  return knex.schema
    .table('TransactionLog', table => {
      table.dropColumn('type');
    });
};
