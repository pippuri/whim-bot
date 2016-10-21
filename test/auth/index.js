'use strict';

describe('auth', () => {
  require('./auth-lib/index.js')();
  require('./auth-sms-request-code/index.js')();
  require('./auth-sms-login/index.js')();
});
