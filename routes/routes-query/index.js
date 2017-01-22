'use strict';

const Database = require('../../lib/models/index').Database;
const routesEngine = require('./lib/index');
const filter = require('./lib/filter');
const MaaSError = require('../../lib/errors/MaaSError');
const BusinessRuleError = require('../../lib/errors/BusinessRuleError');
const signatures = require('../../lib/signatures');


function validateInput(payload) {
  if (!payload.from) {
    return Promise.reject(new MaaSError('Missing "from" input', 400));
  }

  if (!payload.to) {
    return Promise.reject(new MaaSError('Missing "to" input', 400));
  }

  if (payload.leaveAt && payload.arriveBy) {
    return Promise.reject(new MaaSError('Support only leaveAt or arriveBy, not both', 400));
  }

  if (payload.modes && !payload.modes.match(/^[\w\S]+[^,\s]$/g)) {
    return Promise.reject(new MaaSError('Input modes must satisfy this regex ' + /^[\w\S]+[^,\s]$/.toString(), 400));
  }

  if (payload.modes && payload.modes.split(',').length > 1) {
    return Promise.reject(new MaaSError('Routes query currently support either 1 input modes or none', 400));
  }

  if (payload.fromName && !/^([A-ö\d]+[\-/,\.\(\)\s]*)+$/.test(payload.fromName)) {
    return Promise.reject(new MaaSError('Origin name must satisfy this regex ' + /^([A-ö\d]+[\-/,\.\(\)\s]*)+$/.toString(), 400));
  }

  if (payload.toName && !/^([A-ö\d]+[\-/,\.\(\)\s]*)+$/.test(payload.toName)) {
    return Promise.reject(new MaaSError('Destination name must satisfy this regex ' + /^([A-ö\d]+[\-/,\.\(\)\s]*)+$/.toString(), 400));
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
        leg.signature = signatures.sign(leg, process.env.MAAS_SIGNING_SECRET);
      }
    });

    itinerary.signature = signatures.sign(itinerary, process.env.MAAS_SIGNING_SECRET);
  });

  return response;
}

function _constructQuery(payload) {
  // If not leaveAt, search for routes starting 2 mins from now
  if (!payload.leaveAt && !payload.arriveBy) {
    payload.leaveAt = Date.now() + 2 * 60 * 1000;
  }

  const query = {
    from: payload.from,
    to: payload.to,
    leaveAt: payload.leaveAt,
    arriveBy: payload.arriveBy,
    modes: payload.modes,
    fromName: payload.fromName,
    toName: payload.toName,
  };

  return query;
}

module.exports.respond = function (event, callback) {
  return Database.init()
    .then(() => validateInput(event.payload))
    .then(() => _constructQuery(event.payload))
    .then(query => routesEngine.getRoutes(event.identityId, query))
    .then(response => filter.filterPastRoutes(event.payload.leaveAt, response))
    .then(
      response => Database.cleanup().then(() => signResponse(response)),
      error => Database.cleanup().then(() => Promise.reject(error))
    )
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      if (_error instanceof MaaSError) {
        callback(_error);
        return;
      }

      if (_error instanceof BusinessRuleError) {
        callback(new MaaSError(_error.message, _error.code));
      }

      callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
    });
};
