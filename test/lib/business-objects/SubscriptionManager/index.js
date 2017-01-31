'use strict';

let oldDefaults;

before(() => {
  oldDefaults = process.env.RPL_DEFAULTS;
  process.env.RPL_DEFAULTS = JSON.stringify(Object.assign(
    {},
    { 'chargebee-event-actions': 'all-disabled' },
    JSON.parse(oldDefaults || '{}')
  ));
});

after(() => {
  // Clear the extra options for request-promise-lite in the environment
  if (oldDefaults) {
    process.env.RPL_DEFAULTS = oldDefaults;
  } else {
    delete process.env.RPL_DEFAULTS;
  }
});

describe('SubscriptionManager', () => {
  require('./SubscriptionManager.js');
});

require('./subscription-manager-full-flow.js');
