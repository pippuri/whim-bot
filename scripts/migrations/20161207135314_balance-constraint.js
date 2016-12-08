'use strict';

exports.up = function (knex, Promise) {
  return knex.schema
    .raw(`
      ALTER TABLE "Profile"
      ADD CONSTRAINT no_negative_user_balance CHECK (balance >= 0)
    `);
};

exports.down = function (knex, Promise) {
  return knex.schema
    .raw(`
      ALTER TABLE "Profile"
      DROP CONSTRAINT IF EXISTS no_negative_user_balance
    `);
};
