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

function runQuery(query) {
  return Database.init()
    .then(() => Database.knex.raw(query));
}

function shutdown() {
  return Database.cleanup(true);
}

module.exports = {
  clearDBStatistics: () => runQuery(resetStatsQuery),
  removeSeedData: () => runQuery(removeSeedDataQuery),
  insertSeedData: () => runQuery(insertSeedDataQuery),
  shutdown,
};
