'use strict';

const Database = require('../../lib/models').Database;
const profilesData = require('./profiles-seed.json');

const removeSeedProfileQuery = 'DELETE FROM "Profile" WHERE "id" BETWEEN 13370 and 13399';

const resetStatsQuery = 'SELECT pg_stat_reset();';

const insertSeedProfileQuery =
  `
    INSERT INTO "Profile"
    SELECT * FROM json_populate_recordset(NULL::"Profile", '${JSON.stringify(profilesData)}')
  `;

const removeTempTransactionLogQuery =
  `
    DELETE FROM "TransactionLog"
    WHERE "identityId"
    IN (SELECT "identityId" FROM "Profile" WHERE "id" BETWEEN 13370 and 13399)
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
  removeSeedProfileData: () => Database.knex.raw(removeSeedProfileQuery),
  insertSeedProfileData: () => Database.knex.raw(insertSeedProfileQuery),
  removeTestTransactionLog: () => Database.knex.raw(removeTempTransactionLogQuery),
  init,
  shutdown,
};
