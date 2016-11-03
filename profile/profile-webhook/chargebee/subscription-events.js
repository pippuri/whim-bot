'use strict';

const Profile = require('../../../lib/business-objects/Profile');
const Subscription = require('../../../lib/subscription-manager');

const WHIM_DEFAULT = process.env.DEFAULT_WHIM_PLAN;
const NO_PROMO_CODE = undefined;
const SKIP_CHARGEBEE_UPDATE = true;
const FORCE_SUBSCRIPTION_UPDATE = true;


function handle(payload, key, defaultResponse) {
  console.info('handleSubscriptionEvents');
  console.info(JSON.stringify(payload));

  let profile = null;
  let identityId = null;
  let activePlan = null;

  switch (payload.event_type) {
    case 'subscription_created':
    case 'subscription_started':
    case 'subscription_activated':
    case 'subscription_reactivated':
      profile = Subscription.formatUser(payload.content.content);
      identityId = profile.identityId;
      activePlan = profile.plan.id;

      return Profile.confirmSubscription(identityId, activePlan)
        .then(() => defaultResponse);

    case 'subscription_changed':
      console.info(`\t${payload.event_type}`);
      profile = Subscription.formatUser(payload.content.content);
      identityId = profile.identityId;
      activePlan = profile.plan.id;

      return Profile.updateSubscription(identityId,
                                        activePlan,
                                        NO_PROMO_CODE,
                                        SKIP_CHARGEBEE_UPDATE)
        .then(() => defaultResponse);

    case 'subscription_renewed':
      console.info(`\t${payload.event_type}`);
      profile = Subscription.formatUser(payload.content.content);
      identityId = profile.identityId;
      activePlan = profile.plan.id;

      return Profile.renewSubscription(identityId, activePlan, NO_PROMO_CODE)
        .then(() => defaultResponse);

    case 'subscription_cancelled':
    case 'subscription_deleted':
      console.info(`\t${payload.event_type}`);

      profile = Subscription.formatUser(payload.content.content);
      identityId = profile.identityId;
      return Profile.updateSubscription(identityId,
                                        WHIM_DEFAULT,
                                        NO_PROMO_CODE,
                                        SKIP_CHARGEBEE_UPDATE,
                                        FORCE_SUBSCRIPTION_UPDATE)
        .then(() => Profile.update(identityId, { balance: 0 }))
        .then(() => defaultResponse);

    case 'subscription_shipping_address_updated':
      console.info(`\t${payload.event_type}`);
      return defaultResponse;

    default:
      return defaultResponse;
  }
}

module.exports = {
  handle,
};
