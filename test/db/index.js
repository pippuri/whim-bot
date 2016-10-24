'use strict';

const Database = require('../../lib/models').Database;
const profilesData = require('./profiles-seed.json');

const removeSeedDataQuery =
  'DELETE FROM "Profile" where "id" BETWEEN 13370 and 13379';
const resetStatsQuery =
  `
  SELECT pg_stat_reset();
  `;
const insertSeedDataQuery =
  `
    INSERT INTO "Profile"
    SELECT * FROM json_populate_recordset(NULL::"Profile", '${JSON.stringify(profilesData)}')
  `;

function init() {
  return Database.init();
}

function shutdown() {
  if (Database.handleCount > 0) {
    console.warn(`One or more tests left '${Database.handleCount}' handles open.`);
    return Database.cleanup(true);
  }
  return Promise.resolve();
}

module.exports = {
  clearDBStatistics: () => Database.knex.raw(resetStatsQuery),
  removeSeedData: () => Database.knex.raw(removeSeedDataQuery),
  insertSeedData: () => Database.knex.raw(insertSeedDataQuery),
  init,
  shutdown,
};
