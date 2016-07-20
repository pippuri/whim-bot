'use strict';

const Promise = require('bluebird');
const Subscription = require('../../lib/subscription-manager/index.js');
const utils = require('../../lib/utils/index.js');
const MaaS = require('../../lib/maas-operation/index.js');
const PROFILE_FIELD = 'profile';
const BALANCE_FIELD = 'balance';
const PLAN_FIELD = 'plans';
const WHIM_DEFAULT = process.env.DEFAULT_WHIM_PLAN;

/*
 Called when subscription gets renewed, activated etc
 TODO: update the points total in dynamo
*/
function handleSubscriptionUpdate(event, payload) {
  const profile = Subscription.formatUser(payload.content);
  const identity = profile.identityId;
  const activePlan = profile.plan;
  
  return Subscription.getPlans().then( plans => {
    if (!plans || Object.keys(plans).length < 1 || !plans.hasOwnProperty('list')) {
       return Promise.reject(new Error('Communication Error with Chargebee plans'));
    }

    for (var i=0; i < plans.list.length; i++ ) {
      const plan = plans.list[i];
      // reformat to standard from chargebee
      const userPlan = utils.parseSingleChargebeePlan(plan);
      if (userPlan && (userPlan.id === activePlan.id)) {
        // update the user profile with the points of this renewal
        return Promise.all([ 
          MaaS.updateCustomerProfile(identity, PLAN_FIELD, [userPlan]), 
          MaaS.updateCustomerProfile(identity, BALANCE_FIELD, userPlan.pointGrant) 
        ]);
      }
    }
    return Promise.reject(new Error('Did not find the active plan'));
  });
}

/**
 * Called when Chargebee user details are updated, this updates the profile information
 */
function handleDetailsUpdate(event, payload) {
  const profile = Subscription.formatUser(payload.content);
  const identity = profile.identityId;
  return MaaS.updateCustomerProfile(identity, PROFILE_FIELD, profile);
}

/**
 * Called when subscription comes to an end.
 * TODO: update subscription to revert to PAYG
 */
function handleCancellation(event, payload) {
  const profile = Subscription.formatUser(payload.content);
  const identity = profile.identityId;
  return Subscription.getPlanById(WHIM_DEFAULT)
    .then( plan => {
       return MaaS.updateCustomerProfile(identity, PLAN_FIELD, [plan.plan]);
    })
    .then( () => {
      return MaaS.updateCustomerProfile(identity, BALANCE_FIELD, 0);
    });
}

function handleWebhook(event) {
  //const key = event.id;
  const payload = event.payload;

  if (Object.keys(event).length === 0) {
    return Promise.reject(new Error('Input missing'));
  }

  if (!event.hasOwnProperty('payload') || !payload) {
    return Promise.reject(new Error('Payload missing'));
  }

  if (!payload.hasOwnProperty('event_type')) {
    return Promise.reject(new Error('event type missing'));
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
      console.info('Unhandled callback', payload.event_type);
      return Promise.resolve({});
  }
}

/**
 * Export respond to Handler
 */
module.exports.call = event => {
  return handleWebhook(event);
};
