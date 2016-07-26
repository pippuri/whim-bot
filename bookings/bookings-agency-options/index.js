'use strict';

const Promise = require('bluebird');
const MaasError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils/index');
const tsp = require('../../lib/tsp/index');
const priceConversionRate = require('../../lib/business-rule-engine/lib/priceConversionRate.js');
const businessRuleEngine = require('../../lib/business-rule-engine/index');
const Database = require('../../lib/models/index').Database;

/**
 * check input event
 * @return {Promise -> empty} empty response if success
 */
function validateInput(event) {
  if (!event.hasOwnProperty('agencyId')) {
    return Promise.reject(new MaasError('Missing input agencyId', 400));
  }

  if (!event.hasOwnProperty('startTime') || event.startTime === '') {
    return Promise.reject(new MaasError('startTime querystring empty or missing', 500));
  }

  if (!event.hasOwnProperty('endTime') || event.endTime === '') {
    return Promise.reject(new MaasError('endTime querystring empty or missing', 500));
  }

  if (!event.hasOwnProperty('from') || event.from === '') {
    return Promise.reject(new MaasError('from querystring empty or missing', 500));
  }

  return Promise.resolve();
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

  throw new MaasError('Incorrect tsp response format, no price or currency found', 500);
}

/**
 * Check validity of timestamp
 * @param {Int} startTime
 * @param {Int} endTime
 * @return {Boolean || Promise.error} - return Promise if error, true if everything is correct
 */
function checkTimestamp(startTime, endTime) {
  // Check if input time is in milliseconds
  if (startTime && !startTime.match(/[0-9]{10}/g)) {
    return Promise.reject(new MaasError('Input startTime is not in milliseconds', 400));
  }

  if (endTime && !endTime.match(/[0-9]{10}/g)) {
    return Promise.reject(new MaasError('Input endTime is not in milliseconds', 400));
  }

  // Check if input time is in the past
  if (startTime && Date.now() > startTime) {
    return Promise.reject(new MaasError('startTime is in the past'));
  }

  if (endTime && endTime <= Date.now()) {
    return Promise.reject(new MaasError('endTime is in the past'));
  }

  return Promise.resolve();
}

function getAgencyProductOptions(event) {

  return validateInput(event)
    .then(_empty => checkTimestamp())
    .then(_empty => tsp.retrieveBookingOptions( event.agencyId, {
      mode: event.mode,
      from: event.from,
      to: event.to,
      startTime: event.startTime,
      endTime: event.endTime,
      fromRadius: event.fromRadius,
      toRadius: event.toRadius,
    } ) )
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

      response.options.forEach(option => {
        option.terms.price.amount = convertPriceToPoints(event.identityId, option);
        option.terms.price.currency = 'POINT';
        option.signature = utils.sign(option, process.env.MAAS_SIGNING_SECRET);
      });

      return Promise.resolve({
        options: response.options,
      });
    });
}

module.exports.respond = function (event, callback) {
  return Promise.all([
    Database.init(),
    getAgencyProductOptions(event),
  ])
  .spread((_knex, response) => {
    Database.cleanup()
      .then(() => callback(null, response));
  })
  .catch(error => {
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    Database.cleanup()
      .then(() => callback(error));
  });
};
