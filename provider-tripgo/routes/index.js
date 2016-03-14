var Promise = require('bluebird');
var request = require('request-promise');

var TRIPGO_SOUTH_FINLAND_ROUTING_URL = 'https://hadron-fi-southfinland.tripgo.skedgo.com/satapp/routing.json';

var TRIPGO_MODES = [
  "pt_pub"
  //"ps_tax",
  //"me_car",
  //"me_car-s_Ekorent",
  //"me_mot",
  //"cy_bic",
  //"wa_wal",
];

// Docs: http://planck.buzzhives.com/swagger/index.html#!/Routing/get_routing_json

function getTripGoRoutes(from, to) {
  var qs = {
    v: '11',
    from: '(' + from + ')',
    to: '(' + to + ')',
    departAfter: Math.floor(Date.now()/1000),
    arriveBefore: '0',
    modes: TRIPGO_MODES.join(','), // modes to use in routing, separated by commas (get from regions API)
    avoid: '', // public transport modes to avoid, separated by commas
    tt: '3', // preferred transfer time in minutes
    ws: '1', // walking speed (0=slow 1=medium 2=fast)
    cs: '1', // cycling speed (0=slow 1=medium 2=fast)
    wp: '(1, 1, 1, 1)', // weights for price, environmental impact, duration, and convenience between 0.1..2.0
    ir: 'true' // interregional results
  };
  console.log(qs);
  return request.get(TRIPGO_SOUTH_FINLAND_ROUTING_URL, {
    json: true,
    headers: {
      'X-TripGo-Key': process.env.TRIPGO_API_KEY
    },
    qs: qs
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
