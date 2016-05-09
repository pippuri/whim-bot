var request = require('../../lib/hacks/maas-request-promise');
var proj4 = require('proj4');
var adapter = require('./adapter');

proj4.defs('EPSG:2392', '+proj=tmerc +lat_0=0 +lon_0=24 +k=1 +x_0=2500000 +y_0=0 +ellps=intl +units=m +no_defs');

var HSL_BASE_URL = 'http://api.reittiopas.fi/hsl/prod/';

/**
 * Convert Google (WGS84) coordinates to KKJ2 (EPSG:2392)
 */
function convertWGS84ToKKJ2(coords) {
  var from = coords.split(',').reverse().map(parseFloat);
  var to = proj4('WGS84', 'EPSG:2392', from);
  to = to.map(Math.floor).join(',');

  //console.log('Converted from', from, 'to', to);
  return to;
}

function getHslRoutes(from, to, format) {
  return request.get(HSL_BASE_URL, {
    json: true,
    qs: {
      request: 'route',
      from: convertWGS84ToKKJ2(from),
      to: convertWGS84ToKKJ2(to),
      user: process.env.HSL_USERTOKEN,
      pass: process.env.HSL_PASSPHRASE,
    },
  })
  .then(function (result) {
    if (format === 'original') {
      return result;
    } else {
      return adapter(result);
    }
  });
}

module.exports.respond = function (event, callback) {
  getHslRoutes(event.from, event.to, event.format)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
