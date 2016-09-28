'use strict';

exports.up = function (knex, Promise) {
  return knex.schema
    .raw(`
      ALTER TABLE "Provider"
      ADD COLUMN "modes" varchar(240);
    `);
};

exports.down = function (knex, Promise) {
  return knex.schema
    .raw(`
      ALTER TABLE "Provider"
      DROP COLUMN "modes";
    `);
};
