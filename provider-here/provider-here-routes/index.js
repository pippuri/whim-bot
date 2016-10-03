'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const adapter = require('./adapter');
const MaaSError = require('../../lib/errors/MaaSError');

// Docs: https://developer.here.com/rest-apis/documentation/routing/topics/resource-calculate-route.html
const HERE_ROUTE_URL = 'https://route.cit.api.here.com/routing/7.2/calculateroute.json';

/**
 * Parsing MaaS mode into HERE modes
 * Here mode are constructed according to docs
 * @see https://developer.here.com/rest-apis/documentation/routing/topics/resource-param-type-routing-mode.html
 */
function convertToHereMode(inputMode) {
  switch (inputMode) {
    case 'BICYCLE':
      return 'fastest;bicycle';
    case 'CAR':
    case 'TAXI':
      return 'fastest;car';
    case 'WALK':
      return 'fastest;pedestrian';
    default:
      return 'fastest;publicTransportTimeTable';
  }
}

function validateInput(event) {
  if (typeof process.env.HERE_APP_ID === typeof undefined) {
    return Promise.reject(new MaaSError('Missing HERE_APP_ID', 500));
  }

  if (typeof process.env.HERE_APP_CODE === typeof undefined) {
    return Promise.reject(new MaaSError('Missing HERE_APP_CODE', 500));
  }

  if (event.leaveAt && event.arriveBy) {
    return Promise.reject(new MaaSError('Both leaveAt and arriveBy provided.', 400));
  }

  if (event.arriveBy && convertToHereMode(event.mode).indexOf('public') > -1) {
    // "Note: Specifying arrival time is not supported for the estimated Public
    // Transport routing. Requesting will result in an error response."
    // https://developer.here.com/rest-apis/documentation/routing/topics/public-transport-routing-modes.html
    return Promise.reject(new MaaSError('Here API does not support arriveBy for public transportation.', 400));
  }

  if (event.mode && event.mode.split(',').length > 1) {
    return Promise.reject(new MaaSError('Currently support either no input mode or a single one', 400));
  }

  return Promise.resolve();
}

function getHereRoutes(event) {

  const qs = {
    app_id: process.env.HERE_APP_ID,
    app_code: process.env.HERE_APP_CODE,
    walkSpeed: 1.25, // TODO get this as parameter
    waypoint0: 'geo!' + event.from,
    waypoint1: 'geo!' + event.to,
    mode: convertToHereMode(event.mode),
    combineChange: true,
    maneuverAttributes: 'shape,roadName,nextRoadName,publicTransportLine,length',
    alternatives: 9,
    instructionFormat: 'text',
    departure: event.leaveAt ? (new Date(parseInt(event.leaveAt, 10))).toISOString() : 'now',
  };

  // Do not get alternatives for 'TAXI'
  if (event.mode === 'TAXI') {
    delete qs.alternatives;
  }

  return request.get(HERE_ROUTE_URL, { json: true, headers: {}, qs: qs })
    .then(result => adapter(result, event.mode, event.leaveAt, event.arriveBy))
    .catch(_error => {
      // Handle no route found error code 400
      if (_error.statusCode && _error.statusCode === 400 && _error.response.subtype === 'NoRouteFound') {
        const coords = event.from.split(',').map(parseFloat);
        return {
          plan: {
            from: { lat: coords[0], lon: coords[1] },
            itineraries: [],
          },
          debug: {
            error: _error,
          },
        };
      }

      return Promise.reject(new MaaSError(_error));
    });
}

module.exports.respond = function (event, callback) {

  return validateInput(event)
    .then(() => getHereRoutes(event))
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
