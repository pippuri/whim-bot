'use strict';

const bus = require('../../lib/service-bus');
const utils = require('../../lib/utils');
const MaaSError = require('../../lib/errors/MaaSError');
const ValidationError = require('../../lib/validator/ValidationError');
const validator = require('../../lib/validator');

const responseSchema = require('maas-schemas/prebuilt/maas-backend/routes/routes-query/response.json');

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

  if (event.payload.modes && !event.payload.modes.match(/^[\w\S]+[^,\s]$/g)) {
    return Promise.reject(new MaaSError('Input modes must satisfy this regex', new RegExp(/^[\w\S]+[^,\s]$/g).toString()));
  }

  if (event.payload.modes && event.payload.modes.split(',').length > 1) {
    return Promise.reject(new MaaSError('Routes query currently support either 1 input modes or none'));
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
function filterPastRoutes(leaveAt, response) {

  if (!leaveAt) {
    return response;
  }

  const filtered = response.plan.itineraries.filter(itinerary => {
    const waitingTimes = itinerary.legs.map(leg => {
      const waitingTime = (leg.startTime - parseInt(leaveAt, 10));
      return waitingTime;
    });
    const shortest = Math.min.apply(null, waitingTimes);
    const inMinutes = ((shortest / 1000) / 60);
    const margin = 1;
    if (inMinutes < -margin) {
      return false;
    }

    return true;
  });

  response.plan.itineraries = filtered;
  return response;
}

function getRoutes(identityId, from, to, leaveAt, arriveBy, modes) {

  if (!leaveAt && !arriveBy) {
    leaveAt = Date.now();
  }

  const event = {
    from: from,
    to: to,
    leaveAt: leaveAt,
    arriveBy: arriveBy,
    modes: modes,
  };

  return bus.call('MaaS-business-rule-engine', {
    identityId: identityId,
    rule: 'get-routes',
    parameters: event,
  })
  .then(response => filterPastRoutes(leaveAt, response))
  .then(response => validator.validate(responseSchema, response))
  .then(response => utils.toFixed(response, 6))
  .then(response => signResponse(response));
}

module.exports.respond = function (event, callback) {
  return validateInput(event)
    .then(_ => getRoutes(event.identityId, event.payload.from, event.payload.to, event.payload.leaveAt, event.payload.arriveBy, event.payload.modes))
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

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
