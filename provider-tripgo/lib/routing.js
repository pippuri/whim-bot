var Promise = require('bluebird');
var request = require('request-promise');
var adapter = require('./adapter');

var TRIPGO_PUBLIC_MODES = [
  "pt_pub"
  //"ps_tax",
  //"me_car",
  //"me_car-s_Ekorent",
  //"me_mot",
  //"cy_bic",
  //"wa_wal",
];

var TRIPGO_TAXI_MODES = [
  "pt_pub",
  "ps_tax"
];

// Docs: http://planck.buzzhives.com/swagger/index.html#!/Routing/get_routing_json

function getTripGoRoutes(baseUrl, from, to, modes) {
  var qs = {
    v: '11',
    from: '(' + from + ')',
    to: '(' + to + ')',
    departAfter: Math.floor(Date.now()/1000),
    arriveBefore: '0',
    avoid: '', // public transport modes to avoid, separated by commas
    tt: '3', // preferred transfer time in minutes
    ws: '1', // walking speed (0=slow 1=medium 2=fast)
    cs: '1', // cycling speed (0=slow 1=medium 2=fast)
    wp: '(1, 1, 1, 1)', // weights for price, environmental impact, duration, and convenience between 0.1..2.0
    ir: 'true', // interregional results
    modes: modes // modes to use in routing, as an array
  };
  console.log(qs);
  return request.get(baseUrl, {
    json: true,
    headers: {
      'X-TripGo-Key': process.env.TRIPGO_API_KEY
    },
    qs: qs,
    useQuerystring: true
  })
  .then(function (result) {
    if (result.error) {
      return Promise.reject(new Error(result.error));
    } else {
      return result;
    }
  });
}

function getCombinedTripGoRoutes(baseUrl, from, to, format) {
  return Promise.all([
    getTripGoRoutes(baseUrl, from, to, TRIPGO_PUBLIC_MODES),
    getTripGoRoutes(baseUrl, from, to, TRIPGO_TAXI_MODES)
  ])
  .then(function (results) {
    //console.log('Full results:', JSON.stringify(results, null, 2));
    console.log('Results', results[0].groups.length, results[1].groups.length);
    var response = results[0];
    if (results[1] && results[1].groups) {
      results[1].groups.map(function (group) {
        response.groups.push(group);
      });
    }
    if (results[1] && results[1].segmentTemplates) {
      results[1].segmentTemplates.map(function (segmentTemplate) {
        response.segmentTemplates.push(segmentTemplate);
      });
    }
    console.log('Final Results', response.groups.length, format);
    if (format == 'original') {
      return response;
    } else {
      return adapter(response);
    }
  });
}

module.exports.getCombinedTripGoRoutes = getCombinedTripGoRoutes;