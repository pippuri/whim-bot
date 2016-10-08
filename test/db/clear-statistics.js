'use strict';

const assert = require('chai').assert;
const Database = require('../../lib/models').Database;

// A DB query that investigates Postgres performance for tables > 10000 bytes
const query =
`
SELECT pg_stat_reset();
`;

describe('Clears the DB statistics', () => {
  it('Clears the DB statistics', () => {
    return Database.init()
      .then(() => Database.knex.raw(query));
  });
});
