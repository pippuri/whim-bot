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

describe('auth', () => {
  require('./auth-lib/index.js')();
  require('./auth-sms-request-code/index.js')();
  require('./auth-sms-login/index.js')();
  require('./auth-sms-full-flow/index.js')();
  require('./auth-custom-authorizer/index.js');
});
