'use strict';

const Promise = require('bluebird');
const Database = require('../../lib/models/Database');
const errors = require('../../lib/errors/index');
const Chargebee = require('./chargebee.js');

const DEFAULT_RESPONSE = { response: 'OK' };

const VALID_KEYS = {
  KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM: 'chargebee',
  XYlgoTjdyNgjcCdLUgbfPDIP7oyVEho: 'chargebee-live',
};

function handleWebhook(event) {
  const key = event.id;

  if (Object.keys(event).length === 0) {
    return Promise.reject(new errors.MaaSError('Input missing', 400));
  }

  if (!event.hasOwnProperty('payload')) {
    return Promise.reject(new errors.MaaSError('Payload missing', 400));
  }

  if (typeof key !== 'string') {
    return Promise.reject(new errors.MaaSError('Invalid or missing key', 400));
  }

  if (!VALID_KEYS.hasOwnProperty(key)) {
    return Promise.reject(new errors.MaaSError('Unauthorized key', 400));
  }

  switch (VALID_KEYS[key]) {
    case 'chargebee':
    case 'chargebee-live':
      return Chargebee.call(event);
    default:
      console.info('Unhandled callback');
      return Promise.reject(new MaaSError('Use of unauthorized key should not get this far', 500));
  }
}

function wrapToEnvelope(profile, event) {
  return {
    response: profile,
  };
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return Database.init()
    .then(() => handleWebhook(event))
    .then(response => wrapToEnvelope(response, event))
    .then(envelope => callback(null, envelope))
    .catch(errors.alwaysSucceedErrorHandler(callback, event, Database, DEFAULT_RESPONSE));
};
