'use strict';

const MaaSError = require('../../lib/errors/MaaSError');
const Promise = require('bluebird');
const utils = require('../../lib/utils');
const productData = require('./product-data.json');

/**
 * Parses and validates the event input
 * Contents: identityId (mandatory), mode, from, to, agencyId (mandatory),
 * startTime, endTime, fromRadius, toRadius.
 *
 * @param {object} event The input event - see the contents above
 * @return {Promise} Object of parsed parameters if success, MaaSError otherwise
 */

function parseAndValidateInput(event) {
  const identityId = event.identityId;
  const agencyId = (utils.isEmptyValue(event.agencyId)) ? undefined : event.agencyId;

  if (typeof identityId !== 'string' || identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId', 400));
  }

  if (typeof agencyId !== 'string') {
    return Promise.reject(new MaaSError('Missing or invalid input agencyId', 400));
  }

  return Promise.resolve({
    identityId,
    agencyId,
  });
}

function getAgencyProductOptions(event) {
  const products = productData[event.agencyId];
  if (!products) {
    return Promise.reject(new MaaSError(`No product data for given agencyId '${event.agencyId}'`, 400));
  }
  return Promise.resolve({
    agencyId: event.agencyId,
    products,
  });
}

module.exports.respond = function (event, callback) {
  return parseAndValidateInput(event)
  .then(parsed => getAgencyProductOptions(parsed))
  .then(response => (callback(null, response)))
  .catch(_error => {
    console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    if (_error instanceof MaaSError) {
      callback(_error);
      return;
    }
    callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
  });
};
