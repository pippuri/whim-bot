'use strict';

const assert = require('chai').assert;
const Database = require('../../lib/models').Database;

// A DB query that investigates Postgres performance for tables > 10000 bytes
const minSequentialScans = 10;
const minTableSize = 8192;
const minCacheHitRate = 99;
const query =
`
SELECT relname AS schema,
  CASE seq_scan
    WHEN 0 THEN 100
    ELSE 100.0 * idx_scan/(seq_scan+idx_scan)
  END AS hit_rate,
  pg_relation_size(relid::regclass) AS table_size_bytes,
  seq_scan AS num_sequential_scans, idx_scan AS num_index_scans
FROM pg_stat_all_tables
WHERE
    schemaname='public' AND pg_relation_size(relid::regclass) > ${minTableSize}
ORDER BY num_sequential_scans DESC;
`;

describe('Database performance', () => {
  it(`Table queries' index hit rate is >= ${minCacheHitRate}`, () => {
    return Database.init()
      .then(() => Database.knex.raw(query))
      .then(results => {
        results.rows.forEach(row => {
          // Any schema with > 10 sequential scans &  having >0 index misses requires a change in its query design
          assert(row.num_sequential_scans < minSequentialScans || row.hit_rate >=  minCacheHitRate,
            `Schema '${row.schema}' index hit rate is ${Math.round(row.hit_rate)}% - should be >= ${minCacheHitRate}%`);
        });
      })
      .then(
        () => Database.cleanup(),
        () => Database.cleanup()
      );
  });
});
