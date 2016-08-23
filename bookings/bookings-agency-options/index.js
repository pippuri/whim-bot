'use strict';

const Promise = require('bluebird');
const MaaSError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils/index');
const tsp = require('../../lib/tsp/index');
const priceConversionRate = require('../../lib/business-rule-engine/lib/priceConversionRate.js');
const businessRuleEngine = require('../../lib/business-rule-engine/index');
const Database = require('../../lib/models/index').Database;

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
  const toRadius = (utils.isEmptyValue(event.fromRadius)) ? undefined : parseFloat(event.toRadius, 10);

  if (typeof identityId !== 'string' || identityId === '') {
    return Promise.reject(new MaaSError('Missing identityId', 400));
  }

  if (typeof mode !== 'string') {
    return Promise.reject(new MaaSError('Missing or invalid input agencyId', 400));
  }

  if (typeof agencyId !== 'string' || agencyId === '') {
    return Promise.reject(new MaaSError('Missing or invalid input agencyId', 400));
  }

  if (from && !from.some(value => !Number.isInteger(value))) {
    return Promise.reject(new MaaSError(`Invalid from value ${from}, must be '<lat>,<lon>'`, 400));
  }

  if (to && !to.some(value => !Number.isInteger(value))) {
    return Promise.reject(new MaaSError(`Invalid to value ${to}, must be '<lat>,<lon>'`, 400));
  }

  if (fromRadius && !(fromRadius > 0)) {
    return Promise.reject(new MaaSError(`Invalid fromRadius value ${fromRadius}, must be '<lat>,<lon>'`, 400));
  }

  if (toRadius && !(toRadius > 0)) {
    return Promise.reject(new MaaSError(`Invalid toRadius value ${toRadius}, must be '<lat>,<lon>'`, 400));
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
/**
 * Convert input price to point based on businessRuleEngine
 * @param {UUID} identityId
 * @param {Object} booking
 * @return {Float} Price (in point)
 */
function convertPriceToPoints(identityId, booking) {
  const currencyAvailable = !(typeof Object.keys(priceConversionRate).find(currency => currency === booking.terms.price.currency) === typeof undefined);
  if ( booking.terms.price.currency && currencyAvailable) {
    return businessRuleEngine.call(
      {
        rule: 'convert-to-points',
        identityId: identityId,
        parameters: {
          price: booking.terms.price.amount,
          currency: booking.terms.price.currency,
        },
      }
    );
  }

  throw new MaaSError('Incorrect tsp response format, no price or currency found', 500);
}

function getAgencyProductOptions(event) {

  return tsp.retrieveBookingOptions(event.agencyId, {
    mode: event.mode,
    from: event.from,
    to: event.to,
    startTime: event.startTime,
    endTime: event.endTime,
    fromRadius: event.fromRadius,
    toRadius: event.toRadius,
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

      const options = response.options.map(utils.removeNulls);
      options.forEach(option => {
        option.terms.price.amount = convertPriceToPoints(event.identityId, option);
        option.terms.price.currency = 'POINT';
        option.signature = utils.sign(option, process.env.MAAS_SIGNING_SECRET);
      });

      return Promise.resolve(options);
    });
}

/**
 * Formats the response by removing JSON nulls
 *
 * @param {Array} options The unformatted response object
 * @return {object} A valid MaaS Response nesting the object & meta
 */
function formatResponse(options) {
  const trimmed = options.map(utils.removeNulls);

  return Promise.resolve({
    options: trimmed,
    maas: {},
  });
}

module.exports.respond = function (event, callback) {
  return Promise.all([
    Database.init(),
    parseAndValidateInput(event),
  ])
  .spread((_knex, parsed) => getAgencyProductOptions(parsed))
  .then(response => formatResponse(response))
  .then(response => {
    Database.cleanup()
      .then(() => callback(null, response));
  })
  .catch(_error => {
    console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    Database.cleanup()
      .then(() => {
        if (_error instanceof MaaSError) {
          callback(_error);
          return;
        }

        callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
      });
  });
};
