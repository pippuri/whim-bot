'use strict';

const adapter = require('./adapter');
const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError');
const TSPFactory = require('../../lib/tsp/TransportServiceAdapterFactory');

const DEFAULT_MODE = 'TAXI';


function parseAndValidateInput(event) {
  if (!event.leaveAt) {
    return Promise.reject(new MaaSError('No leaveAt parameter provided.', 400));
  }

  if (event.arriveBy) {
    // "Note: Specifying arrival time is not supported for Valopilkku
    // routing. Requesting will result in an error response."
    return Promise.reject(new MaaSError('Here API does not support arriveBy for taxis.', 400));
  }

  if (!utils.isEmptyValue(event.mode)) {
    console.warn('WARNING: event contains `mode` property, this will be ignored. Did you mean `modes`?');
  }

  const modes = utils.isEmptyValue(event.modes) ? [DEFAULT_MODE] : event.modes.split(',');
  if (modes.indexOf(DEFAULT_MODE) === -1) {
    return Promise.reject(new MaaSError(`Unsupported mode(s): ${event.modes}`, 400));
  }

  const from = (utils.isEmptyValue(event.from)) ? undefined : event.from.split(',').map(parseFloat);
  const to = (utils.isEmptyValue(event.to)) ? undefined : event.to.split(',').map(parseFloat);
  const startTime = (utils.isEmptyValue(event.leaveAt)) ? Date.now() + 5000 : parseInt(event.leaveAt, 10);

  const ret = {
    mode: DEFAULT_MODE,
    from: from,
    to: to,
    startTime: startTime,
  };

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
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      // Uncaught, unexpected error
      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
