'use strict';

const request = require('request-promise-lite');
const Promise = require('bluebird');
const tspData = require('../lib/tspData.json');
const MaasError = require('../../lib/errors/MaaSError');
const _ = require('lodash');
const maasUtils = require('../../lib/utils');
const lib = require();

function getAgencyProductOptions(event) {

  if (!event.hasOwnProperty('agencyId')) {
    return Promise.reject(new MaasError('Missing input agencyId', 400));
  }

  if (!event.queryString.hasOwnProperty('startTime') || event.queryString.startTime === '') {
    return Promise.reject(new MaasError('startTime querystring empty or missing'));
  }

  if (!event.queryString.hasOwnProperty('from') || event.queryString.from === '') {
    return Promise.reject(new MaasError('from querystring empty or missing'));
  }

  let queryString = '/?';
  const queryStringKeys = Object.keys(event.queryString);

  queryStringKeys.map(queryKey => {
    queryString += queryKey + '=' + event.queryString[queryKey];
    if (queryStringKeys.indexOf(queryKey) < queryStringKeys.length - 1) {
      queryString += '&';
    }
  });

  console.log(queryString);
  return lib.findAgency(event.agencyId)
    .then(agencyId => {return request.get(tspData[agencyId].adapter.baseUrl + '/options' + queryString);})
    .then(options => {
      if (!_.isArray(options)) {
        options = [options];
      }

      options.forEach(option => {
        if (typeof option === typeof {}) {
          option.signature = maasUtils.sign(option, process.env.MAAS_SIGNING_SECRET);
        }
      });
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
