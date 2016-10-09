'use strict';

describe('profile tools', function () {
  this.timeout(20000);

  // test has gone missing?
  //require('./profile-create/index.js');
  require('./profile-card-update/index.js')();
  require('./profile-manage/index.js')();
  require('./profile-card-get/index.js')();
  require('./profile-webhook/index.js')();
  require('./profile-buy-points/index.js')();
});
