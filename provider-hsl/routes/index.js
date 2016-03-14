var Promise = require('bluebird');
var request = require('request-promise');
var proj4 = require('proj4');

proj4.defs("EPSG:2392", "+proj=tmerc +lat_0=0 +lon_0=24 +k=1 +x_0=2500000 +y_0=0 +ellps=intl +units=m +no_defs");

var HSL_BASE_URL = 'http://api.reittiopas.fi/hsl/prod/';

/**
 * Convert Google (WGS84) coordinates to KKJ2 (EPSG:2392)
 */
function convertWGS84ToKKJ3(coords) {
  var from = coords.split(',').reverse().map(parseFloat);
  var to = proj4('WGS84', 'EPSG:2392', from);
  to = to.map(Math.floor).join(',');
  //console.log('Converted from', from, 'to', to);
  return to;
}


function getHslRoutes(from, to) {
  return request.get(HSL_BASE_URL, {
    json: true,
    qs: {
      request: 'route',
      from: convertWGS84ToKKJ3(from),
      to: convertWGS84ToKKJ3(to),
      user: process.env.HSL_USERTOKEN,
      pass: process.env.HSL_PASSPHRASE
    }
  })
  .then(function (response) {
    console.log('Response:', response);
    return response;
  });
}

module.exports.respond = function (event, callback) {
  getHslRoutes(event.from, event.to)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
