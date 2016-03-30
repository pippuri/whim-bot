var Promise = require('bluebird');
var request = require('request-promise');
var adapter = require('./adapter');

var HERE_ROUTE_URL = 'https://route.cit.api.here.com/routing/7.2/calculateroute.json';

function getHereRoutes(from, to, format) {
  return request.get(HERE_ROUTE_URL, {
    json: true,
    headers: {},
    qs: {
      app_id: process.env.HERE_APP_ID,
      app_code: process.env.HERE_APP_CODE,
      waypoint0: 'geo!' + from,
      waypoint1: 'geo!' + to,
      departure: 'now',
      mode: 'fastest;publicTransport',
      combineChange: 'true',
      maneuverAttributes: 'shape,roadName,nextRoadName'
    }
  })
    .then(function (result) {
    if (format == 'original') {
      return result;
    } else {
      return adapter(result);
    }
  });
}

module.exports.respond = function (event, callback) {
  getHereRoutes(event.from, event.to, event.format)
    .then(function (response) {
    callback(null, response);
  })
    .then(null, function (err) {
    callback(err);
  });
};