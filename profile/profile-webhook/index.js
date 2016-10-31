'use strict';

const Promise = require('bluebird');
const errors = require('../../lib/errors/index');
const utils = require('../lib/utils');

const HANDLERS = [
  require('./dummy/index'),
  require('./chargebee/index'),
];

const DEFAULT_RESPONSE = 'OK';


function validateEventAndExtractKey(event) {
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

  // Remove card information altogether to avoid the possibility of using it
  if (event.payload.content && event.payload.content && event.payload.content.content) {
    event.payload.content.content.card = {};
  }

  return Promise.resolve(key);
}

function handleWebhook(event, key) {
  for (const i in HANDLERS) {
    // Find the first handler to match the key
    if (HANDLERS[i].matches(key)) {
      // Handle the event and break out of the search loop
      return HANDLERS[i].handlePayload(event.payload, key, DEFAULT_RESPONSE);
    }
  }

  // No handler matched the key => error
  return Promise.reject(new errors.MaaSError('Unauthorized key', 400));
}

/**
 * Export respond to Handler
 */
module.exports.respond = (event, callback) => {
  return validateEventAndExtractKey(event)
    .then(key      => handleWebhook(event, key))
    .then(response => utils.wrapToEnvelope(response, event))
    .then(envelope => callback(null, envelope))
    .catch(errors.alwaysSucceedIncludeErrorMessageErrorHandler(
          callback, event, utils.wrapToEnvelope(DEFAULT_RESPONSE), 200));
};

