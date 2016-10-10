'use strict';

exports.up = function (knex, Promise) {
  return knex.schema
    .createTable('Profile', table => {

      // Identifiers
      table.increments('id').primary();
      table.string('identityId').index().notNullable().unique();

      // User data
      table.float('balance').notNullable();

      // Subscriptions
      table.integer('planLevel').notNullable();
      table.specificType('plans', 'jsonb[]');

      // Rich data
      table.specificType('favoriteLocations', 'jsonb[]');

      // User information
      table.string('phone').index().notNullable();
      table.string('email');
      table.string('firstName');
      table.string('lastName');
      table.string('city');
      table.string('country');
      table.integer('zipCode');
      table.string('profileImageUrl');

      // Extra
      table.timestamp('created').notNullable().defaultTo(knex.raw('now()'));
      table.timestamp('modified');
    });
};

exports.down = function (knex, Promise) {
  return knex.schema
    .dropTableIfExists('Profile');
};
