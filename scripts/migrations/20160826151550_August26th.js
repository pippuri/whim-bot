'use strict';

exports.up = function (knex, Promise) {
  return knex.schema
    .raw(`
      ALTER TABLE "Booking"
      ALTER COLUMN "tspId" DROP NOT NULL;
    `);
};

exports.down = function (knex, Promise) {
  return knex.schema
    .raw(`
      ALTER TABLE "Booking"
      ALTER COLUMN "tspId" SET NOT NULL;
    `);
};
