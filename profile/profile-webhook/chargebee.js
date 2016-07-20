'use strict';

const Promise = require('bluebird');
const Subscription = require('../../lib/subscription-manager/index.js');

function handleUpdate(event, payload) {
  return Promise.resolve(Subscription.formatUser(payload.content));
}

function handleCancellation(event, payload) {
  return Promise.resolve( { Cancelled: true } );
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
    return Promise.reject(new Error('Payload missing'));
  }

  switch (payload.event_type) {
    case 'customer_created':
    case 'customer_changed':
    case 'subscription_created':
    case 'subscription_started':
    case 'subscription_changed':
    case 'subscription_renewed':
    case 'card_updated':
    case 'payment_succeeded':
    case 'card_added':
    case 'card_expiry_reminder':
      return handleUpdate(event, payload);
    case 'payment_failed':
    case 'customer_deleted':
    case 'card_expired':
    case 'subscription_cancelled':
    case 'card_deleted':
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
