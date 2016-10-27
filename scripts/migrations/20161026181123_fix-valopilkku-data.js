'use strict';
const providerDump = require('./ProviderDumpOct26.json');
const oldProviderDump = require('./September-23rd-dump.json');

exports.up = function (knex, Promise) {
  return knex.schema
  .raw(`
    DELETE FROM "Provider";
    INSERT INTO "Provider"
    SELECT * FROM json_populate_recordset(NULL::"Provider", '${JSON.stringify(providerDump)}')
  `);
};

exports.down = function (knex, Promise) {
  return knex.schema
  .raw(`
    DELETE FROM "Provider";
    INSERT INTO "Provider"
    SELECT * FROM json_populate_recordset(NULL::"Provider", '${JSON.stringify(oldProviderDump)}')
  `);
};
