'use strict';

exports.up = function (knex) {
  return knex.schema
    .raw(`
      ALTER TABLE "Leg"
      ADD bookingProvider varchar(255)
    `);
};

exports.down = function (knex) {
  return knex.schema
    .raw(`
      ALTER TABLE "Leg"
      DROP COLUMN bookingProvider
    `);
};
