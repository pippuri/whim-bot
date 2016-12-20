'use strict';
const providerDump = require('./20161026181123_fix-valopilkku-data/ProviderDumpOct26.json');
const oldProviderDump = require('./20160923154536_September23rd/September-23rd-dump.json');

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
