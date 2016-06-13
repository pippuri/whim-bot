'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const proj4 = require('proj4');
const xml2js = require('xml2js');
const adapter = require('./adapter');

Promise.promisifyAll(xml2js);

proj4.defs('EPSG:2393', '+proj=tmerc +lat_0=0 +lon_0=27 +k=1 +x_0=3500000 +y_0=0 +ellps=intl +towgs84=-96.062,-82.428,-121.753,4.801,0.345,-1.376,1.496 +units=m +no_defs');

const MATKA_BASE_URL = 'http://api.matka.fi/';

/**
 * Convert Google (WGS84) coordinates to KKJ3 (EPSG:2393)
 */
function convertWGS84ToKKJ3(coords) {
  const from = coords.split(',').reverse().map(parseFloat);
  const to = proj4('WGS84', 'EPSG:2393', from);
  const converted = to.map(Math.floor).join(',');

  //console.log('Converted from', from, 'to', converted);
  return converted;
}

function getMatkaRoutes(from, to, format) {
  return request.get(MATKA_BASE_URL, {
    qs: {
      a: convertWGS84ToKKJ3(from),
      b: convertWGS84ToKKJ3(to),
      user: process.env.MATKA_USERTOKEN,
      pass: process.env.MATKA_PASSPHRASE,
    },
  })
  .then(function (response) {
    return xml2js.parseStringAsync(response, { explicitChildren: true, preserveChildrenOrder: true });
  })
  .then(function (result) {
    console.log('Format:', format);
    if (format === 'original') {
      return result;
    }

    return adapter(result);
  });
}

module.exports.respond = function (event, callback) {
  getMatkaRoutes(event.from, event.to, event.format)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
