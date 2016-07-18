'use strict';

const request = require('request-promise-lite');
const Promise = require('bluebird');
const MaasError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils/index');
const tsp = require('../../lib/tsp/index');

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
    .then(_empty => tsp.findAgency(event.agencyId))
    .then(tsp => request.get(tsp.adapter.baseUrl + tsp.adapter.endpoints.get.options, {
      qs: {
        mode: event.mode,
        from: event.from,
        to: event.to,
        startTime: event.startTime,
        endTime: event.endTime,
      },
      json: true,
    }))
    .then(response => {
      if (response.errorMessage) {
        return Promise.reject(new Error(response.errorMessage));
      }
      // If response.options is undefined, return error
      // which is most likely inside the response
      if (typeof response.options === typeof undefined) {
        console.log(response);
        return {
          options: [],
          meta: {},
        };
      }
      response.options.forEach(option => {
        if (typeof option === 'object') {
          option.signature = utils.sign(option, process.env.MAAS_SIGNING_SECRET);
        }
      });
      return response;

    });
}

module.exports.respond = (event, callback) => {
  return getAgencyProductOptions(event)
    .then(response => {
      callback(null, response);
    })
    .catch(error => {
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(error);
    });
};
