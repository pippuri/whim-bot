'use strict';

const Promise = require('bluebird');
const adapter = require('./adapter');
const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError');
const TSPFactory = require('../../lib/tsp/TransportServiceAdapterFactory');

function parseAndValidateInput(event) {
  if (event.leaveAt && event.arriveBy) {
    return Promise.reject(new MaaSError('Both leaveAt and arriveBy provided.', 400));
  }

  const from = (utils.isEmptyValue(event.from)) ? undefined : event.from.split(',').map(parseFloat);
  const to = (utils.isEmptyValue(event.to)) ? undefined : event.to.split(',').map(parseFloat);
  const startTime = (utils.isEmptyValue(event.leaveAt)) ? Date.now() + 5000 : parseInt(event.leaveAt, 10);
  const endTime = (utils.isEmptyValue(event.leaveAt)) ? undefined : parseInt(event.arriveBy, 10);

  const ret = {
    mode: 'TAXI',
    from: from,
    to: to,
    startTime: startTime,
  };
  if (endTime) {
    ret.endTime = endTime;
  }

  return Promise.resolve(ret);
}


function getValopilkkuRoutes(event) {
  return TSPFactory.createFromAgencyId('Valopilkku')
  .then(tsp => {
    return tsp.query(event);
  })
  .then(response => {
    if (response.errorMessage) {
      return Promise.reject(new Error(response.errorMessage));
    }

    return adapter(response, event);
  });
}


module.exports.respond = function (event, callback) {
  return parseAndValidateInput(event)
    .then(result => getValopilkkuRoutes(result))
    .then(response => {
      callback(null, response);
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      callback(_error);
    });
};

