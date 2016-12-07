'use strict';

exports.up = function (knex, Promise) {
  return knex.schema
    .createTable('TransactionLog', table => {
      // Identifiers
      table.uuid('id').primary().notNullable().unique();
      table.string('identityId').index().notNullable();
      table.string('message').notNullable();
      table.integer('value');
      table.jsonb('meta').notNullable();

      table.timestamp('created').index().notNullable().defaultTo(knex.raw('now()'));
      // Note: Transaction log is not intended to be modified after creation.
      // This is here for the sake of consistency.
      table.timestamp('modified');
    });
};

exports.down = function (knex, Promise) {
  return knex.schema
    .dropTableIfExists('TransactionLog');
};
