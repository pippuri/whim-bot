'use strict';

const testZendeskPushNotification = require('./zendesk-push-notification/zendesk-push-notification.js');
const testWebhooksBookingsUpdate = require('./webhooks-bookings-update/webhooks-bookings-update.js');

describe('Webhooks endpoint', function () {
  this.timeout(20000);

  describe('zendesk-push-notification', function () {
    this.timeout(20000);
    testZendeskPushNotification();
  });

  testWebhooksBookingsUpdate();

});
