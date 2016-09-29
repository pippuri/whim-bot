'use strict';

const bus = require('../../lib/service-bus');
const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError');
const ValidationError = require('../../lib/validator/ValidationError');

function validateInput(event) {
  if (!event.payload.from) {
    return Promise.reject(new MaaSError('Missing "from" input', 400));
  }

  if (!event.payload.to) {
    return Promise.reject(new MaaSError('Missing "to" input', 400));
  }

  if (event.payload.leaveAt && event.payload.arriveBy) {
    return Promise.reject(new MaaSError('Support only leaveAt or arriveBy, not both', 400));
  }

  if (event.payload.mode && !event.payload.mode.match(/^[\w\S]+[^,\s]$/g)) {
    return Promise.reject(new MaaSError('Input mode must satisfy this regex', new RegExp(/^[\w\S]+[^,\s]$/g).toString()));
  }

  if (event.payload.mode && event.payload.mode.split(',').length > 1) {
    return Promise.reject(new MaaSError('Routes query currently support either 1 input mode or none'));
  }

  return Promise.resolve();
}

/**
 * Sign the response
 * @param response {Object}
 * @return response {Object} signed response
 */
function signResponse(response) {
  const itineraries = response.plan.itineraries || [];

  itineraries.map(itinerary => {
    (itinerary.legs || []).map(leg => {
      if (!leg.signature) {
        leg.signature = utils.sign(leg, process.env.MAAS_SIGNING_SECRET);
      }
    });

    itinerary.signature = utils.sign(itinerary, process.env.MAAS_SIGNING_SECRET);
  });

  return response;
}

/**
 * Filter out the past routes
 * TODO Support past route but made it unpurchasable?
 * @param leaveAt {String}
 * @param response {Object}
 * @return response {Object} filtered response
 */
function filterPastRoutes(response) {

  response.plan.itineraries.filter(iti => {
    return iti.startTime < Date.now() - 20000; // Network delay
  });

  return response;
}

function getRoutes(identityId, from, to, leaveAt, arriveBy, mode) {
  if (mode !== undefined && mode.length > 0) {
    mode = mode.split(',');
  }

  if (!leaveAt && !arriveBy) {
    leaveAt = Date.now();
  }

  const event = {
    from: from,
    to: to,
    leaveAt: leaveAt,
    arriveBy: arriveBy,
    mode: mode,
  };

  return bus.call('MaaS-business-rule-engine', {
    identityId: identityId,
    rule: 'get-routes',
    parameters: event,
  })
  .then(response => filterPastRoutes(response))
  .then(response => signResponse(response));
}

module.exports.respond = function (event, callback) {
  return validateInput(event)
    .then(_ => getRoutes(event.identityId, event.payload.from, event.payload.to, event.payload.leaveAt, event.payload.arriveBy))
    .then(response => {
      callback(null, response);
    })
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      if (_error instanceof ValidationError) {
        callback(new MaaSError(_error.message, 400));
        return;
      }

      callback(new MaaSError(`Internal server error: ${_error.message}`, 500));
    });
};
