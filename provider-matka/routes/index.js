var Promise = require('bluebird');
var request = require('request-promise');
var proj4 = require('proj4');

proj4.defs("EPSG:2393","+proj=tmerc +lat_0=0 +lon_0=27 +k=1 +x_0=3500000 +y_0=0 +ellps=intl +towgs84=-96.062,-82.428,-121.753,4.801,0.345,-1.376,1.496 +units=m +no_defs");

var MATKA_BASE_URL = 'http://api.matka.fi/';

/**
 * Convert Google (WGS84) coordinates to KKJ3 (EPSG:2393)
 */
function convertWGS84ToKKJ3(coords) {
  var from = coords.split(',').reverse().map(parseFloat);
  var to = proj4('WGS84', 'EPSG:2393', from);
  to = to.map(Math.floor).join(',');
  //console.log('Converted from', from, 'to', to);
  return to;
}

function getMatkaRoutes(from, to) {
  return request.get(MATKA_BASE_URL, {
    qs: {
      a: convertWGS84ToKKJ3(from),
      b: convertWGS84ToKKJ3(to),
      user: process.env.MATKA_USERTOKEN,
      pass: process.env.MATKA_PASSPHRASE
    }
  })
  .then(function (response) {
    return {
      xml: response
    };
  });
}

module.exports.respond = function (event, callback) {
  getMatkaRoutes(event.from, event.to)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
