var Promise = require('bluebird');
var request = require('request-promise');

var TRIPGO_SOUTH_FINLAND_ROUTING_URL = 'https://hadron-fi-southfinland.tripgo.skedgo.com/satapp/routing.json';

// Get regions from TripGo
function getTripGoRoutes(from, to) {
  return request.get(TRIPGO_SOUTH_FINLAND_ROUTING_URL, {
    json: true,
    headers: {
      'X-TripGo-Key': process.env.TRIPGO_API_KEY
    },
    qs: {
      from: from,
      to: to,
      arriveBefore: '0',
      departAfter: Math.floor(Date.now()),
      wp: '(1.0,1.0,1.0,1.0)',
      unit: 'metric',
      vehiclesFlag: '00010',
      bestOnly: 'false',
      version: 'aTripGo',
      v: '6',
      tt: '0',
      ws: '1',
      cs: '1',
      ss: 'false',
      es: 'false'
    }
  });
}

module.exports.respond = function (event, callback) {
  getTripGoRoutes(event.from, event.to)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
