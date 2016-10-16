'use strict';

const Profile = require('../../lib/business-objects/Profile');
const Promise = require('bluebird');
const Subscription = require('../../lib/subscription-manager');
const MaaSError = require('../../lib/errors/MaaSError');
const WHIM_DEFAULT = process.env.DEFAULT_WHIM_PLAN;

/*
 Called when subscription gets renewed, activated etc
 TODO: update the points total in dynamo
*/
function handleSubscriptionUpdate(event, payload) {
  const profile = Subscription.formatUser(payload.content);
  const identityId = profile.identityId;
  const activePlan = profile.plan.id;

  return Profile.updateSubscription(identityId, activePlan, undefined, true);
}

/**
 * Called when Chargebee user details are updated, this updates the profile information
 */
function handleDetailsUpdate(event, payload) {
  const profile = Subscription.formatUser(payload.content);
  const identityId = profile.identityId;

  // Make sure we have at least something
  if (!profile.hasOwnProperty('address')) {
    profile.address = {};
  }

  return Profile.update(identityId, {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    country: profile.address.country,
    city: profile.address.city,
    zipCode: profile.address.zip,
  });
}

/**
 * Called when subscription comes to an end.
 */
function handleCancellation(event, payload) {
  const profile = Subscription.formatUser(payload.content);
  const identityId = profile.identityId;

  return Profile.updateSubscription(identityId, WHIM_DEFAULT, undefined, true)
    .then(() => Profile.update(identityId, { balance: 0 }));
}

function handleWebhook(event) {
  //const key = event.id;
  const payload = event.payload;

  if (Object.keys(event).length === 0) {
    return Promise.reject(new MaaSError('Input missing', 400));
  }

  if (!event.hasOwnProperty('payload') || !payload) {
    return Promise.reject(new MaaSError('Payload missing', 400));
  }

  if (!payload.hasOwnProperty('event_type')) {
    return Promise.reject(new MaaSError('event type missing', 400));
  }

  switch (payload.event_type) {
    case 'subscription_created':
    case 'subscription_started':
    case 'subscription_changed':
    case 'subscription_reactivated':
    case 'subscription_renewed':
      return handleSubscriptionUpdate(event, payload);
    case 'customer_created':
    case 'customer_changed':
    case 'card_updated':
    case 'payment_succeeded':
    case 'card_added':
    case 'payment_failed':
    case 'card_deleted':
    case 'card_expired':
    case 'card_expiry_reminder':
      return handleDetailsUpdate(event, payload);
    case 'customer_deleted':
    case 'subscription_cancelled':
    case 'subscription_deleted':
      return handleCancellation(event, payload);
    default:
      console.warn('Unhandled callback', payload.event_type);
      return Promise.resolve();
  }
}

/**
 * Export respond to Handler
 */
module.exports.call = event => {
  return handleWebhook(event);
};
