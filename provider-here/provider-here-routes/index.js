'use strict';

var Promise = require('bluebird');
var request = require('request-promise-lite');
var adapter = require('./adapter');

var HERE_ROUTE_URL = 'https://route.cit.api.here.com/routing/7.2/calculateroute.json';

// Docs: https://developer.here.com/rest-apis/documentation/routing/topics/resource-calculate-route.html

function getHereRoutes(from, to, leaveAt, arriveBy, format) {
  var qs = {
    app_id: process.env.HERE_APP_ID,
    app_code: process.env.HERE_APP_CODE,
    waypoint0: 'geo!' + from,
    waypoint1: 'geo!' + to,
    mode: 'fastest;publicTransport',
    combineChange: 'true',
    maneuverAttributes: 'shape,roadName,nextRoadName,publicTransportLine',
  };

  if (leaveAt && arriveBy) {
    return Promise.reject(new Error('Both leaveAt and arriveBy provided.'));
  } else if (leaveAt) {
    qs.departure = (new Date(parseInt(leaveAt, 10))).toISOString();
  } else if (arriveBy) {
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
  .then(function (result) {
    if (format === 'original') {
      return result;
    }

    return adapter(result);
  });
}

module.exports.respond = function (event, callback) {

  if (typeof process.env.HERE_APP_ID === typeof undefined) {
    callback(new Error('Missing HERE_APP_ID'));
  } else if (typeof process.env.HERE_APP_CODE === typeof undefined) {
    callback(new Error('Missing HERE_APP_CODE'));
  } else {
    getHereRoutes(event.from, event.to, event.leaveAt, event.arriveBy, event.format)
    .then(function (response) {
      callback(null, response);
    })
    .catch(function (err) {
      console.log('This event caused error: ' + JSON.stringify(event, null, 2));
      callback(err);
    });
  }

};
