var Promise = require('bluebird');
var request = require('request-promise');
var adapter = require('./adapter');

var TRIPGO_PUBLIC_MODES = [
  'pt_pub',

  //'ps_tax',
  //'me_car',
  //'me_car-s_Ekorent',
  //'me_mot',
  //'cy_bic',
  //'wa_wal',
];

var TRIPGO_TAXI_MODES = [
  'pt_pub',
  'ps_tax',
];

// Docs: http://planck.buzzhives.com/swagger/index.html#!/Routing/get_routing_json

function getTripGoRoutes(baseUrl, from, to, leaveAt, arriveBy, modes) {
  var qs = {
    v: '11',
    from: '(' + from + ')',
    to: '(' + to + ')',
    avoid: '', // public transport modes to avoid, separated by commas
    tt: '3', // preferred transfer time in minutes
    ws: '1', // walking speed (0=slow 1=medium 2=fast)
    cs: '1', // cycling speed (0=slow 1=medium 2=fast)
    wp: '(1, 1, 1, 1)', // weights for price, environmental impact, duration, and convenience between 0.1..2.0
    ir: 'true', // interregional results
    modes: modes, // modes to use in routing, as an array
  };
  if (leaveAt && arriveBy) {
    return Promise.reject(new Error('Both leaveAt and arriveBy provided.'));
  } else if (leaveAt) {
    qs.departAfter = Math.floor(parseInt(leaveAt, 10) / 1000);
  } else if (arriveBy) {
    qs.arriveBefore = Math.floor(parseInt(arriveBy, 10) / 1000);
  } else {
    qs.departAfter = Math.floor(Date.now() / 1000);
  }

  return request.get(baseUrl, {
    json: true,
    headers: {
      'X-TripGo-Key': process.env.TRIPGO_API_KEY,
    },
    qs: qs,
    useQuerystring: true,
  })
  .then(function (result) {
    if (result.error) {
      return Promise.reject(new Error(result.error));
    } else {
      return result;
    }
  });
}

function getCombinedTripGoRoutes(baseUrl, from, to, leaveAt, arriveBy, format) {
  return Promise.all([
    getTripGoRoutes(baseUrl, from, to, leaveAt, arriveBy, TRIPGO_PUBLIC_MODES),
    getTripGoRoutes(baseUrl, from, to, leaveAt, arriveBy, TRIPGO_TAXI_MODES),
  ])
  .then(function (results) {
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

    if (format === 'original') {
      return response;
    } else {
      return adapter(response);
    }

  });
}

module.exports.getCombinedTripGoRoutes = getCombinedTripGoRoutes;
