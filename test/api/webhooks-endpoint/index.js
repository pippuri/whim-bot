'use strict';

const testZendeskPushNotification = require('./zendesk-push-notification/zendesk-push-notification.js');
const testWebhooksBookingsUpdate = require('./webhooks-bookings-update/webhooks-bookings-update.js');

describe('webhooks endpoint', function () { //eslint-disable-line
  describe('zendesk-push-notification', function () { //eslint-disable-line
    testZendeskPushNotification();
  });

  testWebhooksBookingsUpdate();
});
