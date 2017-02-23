'use strict';

const dbUtils = require('./db');
const loadEnvironment = require('../scripts/load-environment').loadEnvironment;

loadEnvironment();

if (!process.env.DEBUG) {
  const originalConsole = { log: console.log };

  console.log = function () {
    let args = Array.from(arguments);
    args = args.filter(item => {
      if (item !== null && typeof item !== 'undefined') {
        return !item.toString().includes('WARNING: This variable is not defined:');
      }
      return true;
    });
    originalConsole.log.apply(null, args);
  };
  console.info = () => {};
  console.warn = () => {};
}

// Test flag
process.env.IS_TEST_ENVIRONMENT = 'TRUE';

// Force local lambda & dynamo usage
process.env.USE_MOCK_LAMBDA = 'TRUE';

// Force request-promise-lite defaults to disable Chargebee webhooks
process.env.RPL_DEFAULTS = JSON.stringify({
  headers: {
    'chargebee-event-webhook': 'all-disabled',
    'chargebee-event-emails': 'all-disabled',
  },
});

// DB performance pre-setup (clear statistics) & seed data
before(() => {
  console.log('Preparing Database for tests');
  return dbUtils.init()
    .then(() => dbUtils.removeSeedProfileData())
    .then(() => dbUtils.insertSeedProfileData())
    .then(() => dbUtils.clearDBStatistics())
    .then(() => dbUtils.shutdown());
});

// The actual suite
require('./lib');
require('./auth');
require('./profile');
require('./provider');
require('./business-rule-engine');
require('./api');

// Tests for DB performance of the past operations
require('./db/test-statistics');

// Somehow mocha fails silently if we do these in after hook
// See https://github.com/sindresorhus/gulp-mocha/issues/129
describe('DB Shutdown', () => {
  it('Shuts down properly', () => {
    return dbUtils.init()
      .then(() => dbUtils.removeTestTransactionLog())
      .then(() => dbUtils.shutdown());
  });
});
