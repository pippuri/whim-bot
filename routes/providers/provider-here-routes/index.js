'use strict';
/**
 * HERE Routes provider.
 *
 * @see https://developer.here.com/rest-apis/documentation/routing/topics/resource-calculate-route.html
 */

const lib = require('./lib');
const MaaSError = require('../../../lib/errors/MaaSError');
const request = require('request-promise-lite');

const HERE_ROUTE_URL = 'https://route.cit.api.here.com/routing/7.2/calculateroute.json';
const HERE_WALKING_SPEED = 1.39; // 1,39m/s ~ 5km/h

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
    case 'PUBLIC_TRANSIT':
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

  if (event.arriveBy && convertToHereMode(event.modes).indexOf('public') > -1) {
    // "Note: Specifying arrival time is not supported for the estimated Public
    // Transport routing. Requesting will result in an error response."
    // https://developer.here.com/rest-apis/documentation/routing/topics/public-transport-routing-modes.html
    return Promise.reject(new MaaSError('Here API does not support arriveBy for public transportation.', 400));
  }

  if (event.modes && event.modes.split(',').length > 1) {
    return Promise.reject(new MaaSError('Currently support either no input mode or a single one', 400));
  }

  return Promise.resolve();
}

function getHereRoutes(event) {

  const departure = new Date(event.leaveAt ? parseInt(event.leaveAt, 10) : Date.now());
  const qs = {
    app_id: process.env.HERE_APP_ID,
    app_code: process.env.HERE_APP_CODE,
    walkSpeed: HERE_WALKING_SPEED,
    waypoint0: 'geo!' + event.from,
    waypoint1: 'geo!' + event.to,
    combineChange: false,
    mode: convertToHereMode(event.modes),
    routeAttributes: 'legs,groups,lines',
    legAttributes: 'length,travelTime',
    maneuverAttributes: 'shape,roadName,roadNumber,nextRoadName,nextRoadNumber,publicTransportLine,length,time,waitTime,travelTime',
    alternatives: 9,
    instructionFormat: 'text',
    departure: departure.toISOString(),
  };

  // Do not get alternatives for 'TAXI'
  if (event.modes === 'TAXI') {
    delete qs.alternatives;
  }

  const coords = event.from.split(',').map(parseFloat);
  return request.get(HERE_ROUTE_URL, { json: true, headers: {}, qs: qs })
    .then(response => {
      return {
        plan: {
          from: {
            lat: coords[0],
            lon: coords[1],
          },
          itineraries: response.response.route.map(lib.toItinerary),
        },
        debug: {},
      };
    })
    .catch(_error => {
      // Handle no route found error code 400
      if (_error.statusCode && _error.statusCode === 400 && _error.response.subtype === 'NoRouteFound') {
        const coords = event.from.split(',').map(parseFloat);
        return {
          plan: {
            from: {
              lat: coords[0],
              lon: coords[1],
            },
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
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
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
