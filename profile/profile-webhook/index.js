'use strict';

const Promise = require('bluebird');
const Chargebee = require('./chargebee.js');
const VALID_KEYS = {
  KaGBVLzUEZjaR2F9YgoRdHyJ6IhqjGM: 'chargebee',
};


function handleWebhook(event) {
  const key = event.id;

  if (Object.keys(event).length === 0) {
    return Promise.reject(new Error('Input missing'));
  }

  if (!event.hasOwnProperty('payload')) {
    return Promise.reject(new Error('Payload missing'));
  }

  if (typeof key !== 'string') {
    return Promise.reject(new Error('Invalid or missing key'));
  }

  if (!VALID_KEYS.hasOwnProperty(key)) {
    return Promise.reject(new Error('Unauthorized key'));
  }

  switch (VALID_KEYS[key]) {
    case 'chargebee':
      return Chargebee.call(event);
    default:
      console.info('Unhandled callback');
      return Promise.reject(new Error('Use of unauthorized key should not get this far'));
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
  return handleWebhook(event)
    .then(response => wrapToEnvelope(response, event))
    .then(envelope => callback(null, envelope))
    .catch(error => {
      console.log('This event caused an error, but ignoring: ' + JSON.stringify(event, null, 2), error);
      callback(null, { result: 'ERROR' });
      //callback(error);
    });
};
