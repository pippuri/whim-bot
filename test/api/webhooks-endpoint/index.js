'use strict';

const testZendeskPushNotification = require('./zendesk-push-notification.js');

describe('webhooks endpoint', function () {
  this.timeout(20000);

  describe('zendesk-push-notification', function () {
    this.timeout(20000);
    testZendeskPushNotification();
  });

});
