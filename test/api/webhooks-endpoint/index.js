'use strict';

const testZendeskPushNotification = require('./zendesk-push-notification/zendesk-push-notification.js');
const testWebhooksBookingsUpdate = require('./webhooks-bookings-update/webhooks-bookings-update.js');

describe('webhooks endpoint', function () {
  describe('zendesk-push-notification', function () {
    testZendeskPushNotification();
  });

  testWebhooksBookingsUpdate();
});
