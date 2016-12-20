'use strict';

const dump = require('./20160923154536_September23rd/September-23rd-dump.json');

exports.up = function (knex, Promise) {
  return knex.schema
    .raw(`
      ALTER TABLE "Provider"
      ADD COLUMN "modes" varchar(240);
    `)
    .raw(`
      INSERT INTO "Provider"
      SELECT * FROM json_populate_recordset(NULL::"Provider", '${JSON.stringify(dump)}')
    `);
};

exports.down = function (knex, Promise) {
  return knex.schema
    .raw(`
      ALTER TABLE "Provider"
      DROP COLUMN "modes";
    `);
};
