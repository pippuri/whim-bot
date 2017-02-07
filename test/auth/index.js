'use strict';

describe('auth', () => {
  require('./auth-lib/index.js')();
  require('./auth-sms-request-code/index.js')();
  require('./auth-sms-login/index.js')();
  require('./auth-sms-full-flow/index.js')();
  require('./auth-custom-authorizer/index.js');
});
