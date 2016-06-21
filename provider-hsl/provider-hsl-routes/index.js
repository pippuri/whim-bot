'use strict';

const request = require('request-promise-lite');
const proj4 = require('proj4');
const adapter = require('./adapter');

proj4.defs('EPSG:2392', '+proj=tmerc +lat_0=0 +lon_0=24 +k=1 +x_0=2500000 +y_0=0 +ellps=intl +units=m +no_defs');

const HSL_BASE_URL = 'http://api.reittiopas.fi/hsl/prod/';

/**
 * Convert Google (WGS84) coordinates to KKJ2 (EPSG:2392)
 */
function convertWGS84ToKKJ2(coords) {
  const from = coords.split(',').reverse().map(parseFloat);
  const to = proj4('WGS84', 'EPSG:2392', from);
  const converted = to.map(Math.floor).join(',');

  //console.log('Converted from', from, 'to', converted);
  return converted;
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
  .then(result => {
    if (format === 'original') {
      return result;
    }

    return adapter(result);
  });
}

module.exports.respond = function (event, callback) {
  getHslRoutes(event.from, event.to, event.format)
  .then(response => {
    callback(null, response);
  })
  .catch(err => {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
