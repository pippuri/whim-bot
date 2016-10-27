'use strict';

const Database = require('../../../lib/models/Database');

const errors = require('../../../lib/errors/index');
const cardEvents = require('./card-events.js');
const creditNoteEvents = require('./credit-note-events.js');
const customerEvents = require('./customer-events.js');
const invoiceEvents = require('./invoice-events.js');
const paymentEvents = require('./payment-events.js');
const subscriptionEvents = require('./subscription-events.js');
const transactionEvents = require('./transaction-events.js');


const VALID_KEYS = {
  KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM: 'chargebee',
  XYlgoTjdyNgjcCdLUgbfPDIP7oyVEho: 'chargebee-live',
};

function handleUnknownEvent(payload, key, defaultResponse) {
  console.warn('Unhandled webhook event', payload.event_type);
  return defaultResponse;
}

function handleEvent(payload, key, defaultResponse, db) {
  switch (payload.event_type) {
    case 'card_added':
    case 'card_deleted':
    case 'card_expired':
    case 'card_expiry_reminder':
    case 'card_updated':
      // Currently ignored
      return cardEvents.handle(payload, key, defaultResponse);
    case 'credit_note_created':
    case 'credit_note_deleted':
    case 'credit_note_updated':
      // Currently ignored
      return creditNoteEvents.handle(payload, key, defaultResponse);
    case 'customer_changed':
    case 'customer_created':
    case 'customer_deleted':
      return customerEvents.handle(payload, key, defaultResponse);
    case 'pending_invoice_created':
    case 'invoice_deleted':
    case 'invoice_generated':
    case 'invoice_updated':
      // Currently ignored
      return invoiceEvents.handle(payload, key, defaultResponse);
    case 'payment_failed':
    case 'payment_initiated':
    case 'payment_refunded':
    case 'payment_succeeded':
    case 'refund_initiated':
      // Currently ignored
      return paymentEvents.handle(payload, key, defaultResponse);
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
      return subscriptionEvents.handle(payload, key, defaultResponse);
    case 'transaction_created':
    case 'transaction_deleted':
    case 'transaction_updated':
      // Currently ignored
      return transactionEvents.handle(payload, key, defaultResponse);
    default:
      return handleUnknownEvent(payload, key, defaultResponse);
  }
}

function matches(key) {
  return VALID_KEYS.hasOwnProperty(key);
}

function handlePayload(payload, key, defaultResponse) {
  if (!payload.hasOwnProperty('event_type')) {
    return Promise.reject(new errors.MaaSError('event type missing', 400));
  }

  return Database.init()
    .then(db => handleEvent(payload, key, defaultResponse, db))
    .finally(() => {
      console.log('FINALLY');
      Database.cleanup();
    });
}

module.exports = {
  matches,
  handlePayload,
};

