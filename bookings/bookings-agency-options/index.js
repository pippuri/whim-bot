'use strict';

const request = require('request-promise-lite');
const Promise = require('bluebird');
const MaasError = require('../../lib/errors/MaaSError');
const utils = require('../../lib/utils/index');
const tsp = require('../../lib/tsp/index');

function getAgencyProductOptions(event) {

  if (!event.hasOwnProperty('agencyId')) {
    return Promise.reject(new MaasError('Missing input agencyId', 400));
  }

  if (!event.payload.hasOwnProperty('startTime') || event.payload.startTime === '') {
    return Promise.reject(new MaasError('startTime querystring empty or missing'));
  }

  if (!event.payload.hasOwnProperty('from') || event.payload.from === '') {
    return Promise.reject(new MaasError('from querystring empty or missing'));
  }

  let queryString = '/?';
  const queryStringKeys = Object.keys(event.payload);

  queryStringKeys.map(queryKey => {
    queryString += queryKey + '=' + event.payload[queryKey];
    if (queryStringKeys.indexOf(queryKey) < queryStringKeys.length - 1) {
      queryString += '&';
    }
  });

  return tsp.findAgency(event.agencyId)
    .then(tsp => request.get(tsp.adapter.baseUrl + tsp.adapter.endpoints.get.options + queryString, { json: true }))
    .then(response => {
      // If response.options is undefined, return empty
      if (typeof response.options === typeof undefined) {
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
