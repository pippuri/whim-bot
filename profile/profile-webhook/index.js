'use strict';

const Promise = require('bluebird');
const Database = require('../../lib/models/Database');
const MaaSError = require('../../lib/errors/MaaSError');
const Chargebee = require('./chargebee.js');
const VALID_KEYS = {
  KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM: 'chargebee',
  XYlgoTjdyNgjcCdLUgbfPDIP7oyVEho: 'chargebee-live',
};

function handleWebhook(event) {
  const key = event.id;

  if (Object.keys(event).length === 0) {
    return Promise.reject(new MaaSError('Input missing', 400));
  }

  if (!event.hasOwnProperty('payload')) {
    return Promise.reject(new MaaSError('Payload missing', 400));
  }

  if (typeof key !== 'string') {
    return Promise.reject(new MaaSError('Invalid or missing key', 400));
  }

  if (!VALID_KEYS.hasOwnProperty(key)) {
    return Promise.reject(new MaaSError('Unauthorized key', 400));
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
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    })
    .finally(() => {
      Database.cleanup();
    });
};
