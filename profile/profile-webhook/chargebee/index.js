'use strict';

const Database = require('../../../lib/models/Database');

const errors = require('../../../lib/errors/index');
const addonEvents = require('./addon-events.js');
const cardEvents = require('./card-events.js');
const creditNoteEvents = require('./credit-note-events.js');
const couponEvents = require('./coupon-events.js');
const customerEvents = require('./customer-events.js');
const invoiceEvents = require('./invoice-events.js');
const paymentEvents = require('./payment-events.js');
const planEvents = require('./plan-events.js');
const subscriptionEvents = require('./subscription-events.js');
const transactionEvents = require('./transaction-events.js');

const VALID_KEYS = {
  KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM: 'chargebee',
  XYlgoTjdyNgjcCdLUgbfPDIP7oyVEho: 'chargebee-live',
};

function handleUnknownEvent(payload, key) {
  console.warn('Unhandled webhook event', payload.event_type);
  throw new errors.MaaSError('Unhandled webhook event', 400);
}

function handleEvent(payload, key) {
  switch (payload.event_type) {
    case 'addon_created':
    case 'addon_deleted':
    case 'addon_updated':
      return addonEvents.handle(payload, key);
    case 'card_added':
    case 'card_deleted':
    case 'card_expired':
    case 'card_expiry_reminder':
    case 'card_updated':
      return cardEvents.handle(payload, key);
    case 'credit_note_created':
    case 'credit_note_deleted':
    case 'credit_note_updated':
      // Currently ignored
      return creditNoteEvents.handle(payload, key);
    case 'coupon_created':
    case 'coupon_deleted':
    case 'coupon_updated':
      // Currently ignored
      return couponEvents.handle(payload, key);
    case 'customer_changed':
    case 'customer_created':
    case 'customer_deleted':
      return customerEvents.handle(payload, key);
    case 'pending_invoice_created':
    case 'invoice_deleted':
    case 'invoice_generated':
    case 'invoice_updated':
      // Currently ignored
      return invoiceEvents.handle(payload, key);
    case 'payment_failed':
    case 'payment_initiated':
    case 'payment_refunded':
    case 'payment_succeeded':
    case 'refund_initiated':
      // Currently ignored
      return paymentEvents.handle(payload, key);
    case 'plan_created':
    case 'plan_deleted':
    case 'plan_updated':
      // Currently ignored
      return planEvents.handle(payload, key);
    case 'subscription_activated':
    case 'subscription_cancellation_reminder':
    case 'subscription_cancellation_scheduled':
    case 'subscription_cancelled':
    case 'subscription_changed':
    case 'subscription_created':
    case 'subscription_deleted':
    case 'subscription_reactivated':
    case 'subscription_renewal_reminder':
    case 'subscription_renewed':
    case 'subscription_scheduled_cancellation_removed':
    case 'subscription_shipping_address_updated':
    case 'subscription_started':
    case 'subscription_trial_end_reminder':
      return subscriptionEvents.handle(payload, key);
    case 'transaction_created':
    case 'transaction_deleted':
    case 'transaction_updated':
      // Currently ignored
      return transactionEvents.handle(payload, key);
    default:
      return handleUnknownEvent(payload, key);
  }
}

function matches(key) {
  return VALID_KEYS.hasOwnProperty(key);
}

function handlePayload(payload, key) {
  if (!payload.hasOwnProperty('event_type')) {
    return Promise.reject(new errors.MaaSError('event type missing', 400));
  }

  return Database.init()
    .then(db => handleEvent(payload, key))
    .then(
      profile => Database.cleanup(),
      error => Database.cleanup().then(() => Promise.reject(error))
    );
}

module.exports = {
  matches,
  handlePayload,
};
