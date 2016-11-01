'use strict';

const bus = require('../../lib/service-bus');
const MaaSError = require('../../lib/errors/MaaSError');
const Promise = require('bluebird');
const signatures = require('../../lib/signatures');
const TSPFactory = require('../../lib/tsp/TransportServiceAdapterFactory');
const utils = require('../../lib/utils');

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
  const mode = (utils.isEmptyValue(event.mode)) ? undefined : event.mode;
  const from = (utils.isEmptyValue(event.from)) ? undefined : event.from.split(',').map(parseFloat);
  const to = (utils.isEmptyValue(event.to)) ? undefined : event.to.split(',').map(parseFloat);
  const agencyId = (utils.isEmptyValue(event.agencyId)) ? undefined : event.agencyId;
  const startTime = (utils.isEmptyValue(event.startTime)) ? undefined : parseInt(event.startTime, 10);
  const endTime = (utils.isEmptyValue(event.endTime)) ? undefined : parseInt(event.endTime, 10);
  const fromRadius = (utils.isEmptyValue(event.fromRadius)) ? undefined : parseFloat(event.fromRadius, 10);
  const toRadius = (utils.isEmptyValue(event.toRadius)) ? undefined : parseFloat(event.toRadius, 10);

  if (typeof identityId !== 'string' || identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId', 400));
  }

  if (typeof agencyId !== 'string') {
    return Promise.reject(new MaaSError('Missing or invalid input agencyId', 400));
  }

  if (from && !from.some(value => !Number.isInteger(value))) {
    return Promise.reject(new MaaSError(`Invalid from value ${from}, must be '<lat>,<lon>'`, 400));
  }

  if (to && !to.some(value => !Number.isInteger(value))) {
    return Promise.reject(new MaaSError(`Invalid to value ${to}, must be '<lat>,<lon>'`, 400));
  }

  if (fromRadius && !(fromRadius > 0)) {
    return Promise.reject(new MaaSError(`Invalid fromRadius value ${fromRadius}`, 400));
  }

  if (toRadius && !(toRadius > 0)) {
    return Promise.reject(new MaaSError(`Invalid toRadius value ${toRadius}`, 400));
  }

  if (typeof startTime !== typeof undefined && startTime <= 0) {
    const message = `Invalid startTime: ${event.startTime}; expecting positive integer`;
    return Promise.reject(new MaaSError(message, 400));
  }

  if (typeof endTime !== typeof undefined && endTime <= 0) {
    const message = `Invalid startTime: ${event.endTime}; expecting positive integer`;
    return Promise.reject(new MaaSError(message, 400));
  }

  // Check if input times are in the past
  if (startTime && Date.now() > startTime) {
    return Promise.reject(new MaaSError('startTime is in the past', 400));
  }

  if (endTime && endTime <= Date.now()) {
    return Promise.reject(new MaaSError('endTime is in the past', 400));
  }

  return Promise.resolve({
    identityId,
    agencyId,
    mode,
    from,
    to,
    fromRadius,
    toRadius,
    startTime,
    endTime,
  });
}

function getAgencyProductOptions(event) {
  return TSPFactory.createFromAgencyId(event.agencyId)
  .then(tsp => {
    return tsp.query({
      mode: event.mode,
      from: event.from,
      to: event.to,
      startTime: event.startTime,
      endTime: event.endTime,
      fromRadius: event.fromRadius,
      toRadius: event.toRadius,
    });
  })
  .then(response => {
    if (response.errorMessage) {
      return Promise.reject(new Error(response.errorMessage));
    }
    // If response.options is undefined, return error
    // which is most likely inside the response
    if (typeof response.options === typeof undefined) {
      return Promise.resolve({
        options: [],
        meta: {},
      });
    }

    // If empty response, do not do price conversion
    if (response.options instanceof Array && response.options.length === 0) {
      return response.options;
    }

    const prices = [];
    const options = response.options;

    // Collect the prices for batch pricing call
    options.forEach(option => {
      prices.push( { amount: option.cost.amount, currency: option.cost.currency } );
    });

    if (prices.length > 0  && prices[0].currency) {
      return bus.call('MaaS-business-rule-engine', {
        identityId: event.identityId,
        rule: 'get-point-pricing-batch',
        parameters: {
          prices: prices,
        },
      })
      .then(points => {
        options.forEach((option, index) => {
          // Inject price
          const price = points[index];
          option.fare = {
            amount: price,
            currency: 'POINT',
          };
          option.signature = signatures.sign(option, process.env.MAAS_SIGNING_SECRET);

          // Inject agencyId
          option.leg.agencyId = event.agencyId;

          return option;
        });

        return options;
      });
    }

    return Promise.reject(new MaaSError('Incorrect tsp price or currency format ', 500));
  });
}

/**
 * Formats the response by removing JSON nulls
 *
 * @param {Array} options The unformatted response object
 * @return {object} A valid MaaS Response nesting the object & meta
 */
function formatResponse(options) {
  const trimmed = options.map(utils.sanitize);

  return Promise.resolve({
    options: trimmed,
    maas: {},
  });
}

module.exports.respond = function (event, callback) {
  return parseAndValidateInput(event)
  .then(parsed => getAgencyProductOptions(parsed))
  .then(response => formatResponse(response))
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
