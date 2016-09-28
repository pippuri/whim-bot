'use strict';

exports.up = function (knex, Promise) {
  return knex.schema
    .raw(`
      ALTER TABLE "Provider"
      ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT TRUE;
    `);
};

exports.down = function (knex, Promise) {
  return knex.schema
    .raw(`
      ALTER TABLE "Provider"
      DROP COLUMN "active";
    `);
};
