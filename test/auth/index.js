'use strict';

describe('auth', function () {
  this.timeout(20000);

  require('./auth-lib/index.js')();
  require('./auth-sms-request-code/index.js')();
  require('./auth-sms-login/index.js')();
});
