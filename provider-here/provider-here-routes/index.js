'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const adapter = require('./adapter');

const HERE_ROUTE_URL = 'https://route.cit.api.here.com/routing/7.2/calculateroute.json';

// Docs: https://developer.here.com/rest-apis/documentation/routing/topics/resource-calculate-route.html

function getHereRoutes(from, to, leaveAt, arriveBy, format, mode) {
  const qs = {
    app_id: process.env.HERE_APP_ID,
    app_code: process.env.HERE_APP_CODE,
    walkSpeed: 1.25, // TODO get this as parameter
    waypoint0: 'geo!' + from,
    waypoint1: 'geo!' + to,
    mode: mode ? mode : 'fastest;publicTransport', // eslint-disable-line no-unneeded-ternary
    combineChange: 'true',
    maneuverAttributes: 'shape,roadName,nextRoadName,publicTransportLine,length',
  };

  if (leaveAt && arriveBy) {
    return Promise.reject(new Error('Both leaveAt and arriveBy provided.'));
  } else if (leaveAt) {
    qs.departure = (new Date(parseInt(leaveAt, 10))).toISOString();
  } else if (arriveBy && qs.mode.indexOf('public') > -1) {
    // "Note: Specifying arrival time is not supported for the estimated Public
    // Transport routing. Requesting will result in an error response."
    // https://developer.here.com/rest-apis/documentation/routing/topics/public-transport-routing-modes.html
    return Promise.reject(new Error('Here API does not support arriveBy for public transportation.'));
  } else {
    qs.departure = 'now';
  }

  return request.get(HERE_ROUTE_URL, {
    json: true,
    headers: {},
    qs: qs,
  })
  .then(result => adapter(result,  mode, leaveAt, arriveBy))
  .catch(_error => {
    if (_error.statusCode && _error.statusCode === 400 && _error.response.subtype === 'NoRouteFound') {
      const coords = from.split(',').map(parseFloat);
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

    return Promise.reject(_error);
  });
}

module.exports.respond = function (event, callback) {

  if (typeof process.env.HERE_APP_ID === typeof undefined) {
    callback(new Error('Missing HERE_APP_ID'));
  } else if (typeof process.env.HERE_APP_CODE === typeof undefined) {
    callback(new Error('Missing HERE_APP_CODE'));
  } else {
    getHereRoutes(event.from, event.to, event.leaveAt, event.arriveBy, event.format, event.mode)
      .then(response => {
        callback(null, response);
      })
      .catch(_error => {
        console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
        console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
        console.warn(_error.stack);

        callback(_error);
      });
  }
};
