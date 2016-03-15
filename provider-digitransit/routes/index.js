var Promise = require('bluebird');
var request = require('request-promise');
var xml2js = require('xml2js');

Promise.promisifyAll(xml2js);

var DIGITRANSIT_HSL_URL = 'http://beta.digitransit.fi/otp/routers/hsl/plan';

function getDigitransitRoutes(from, to) {
  return request.get(DIGITRANSIT_HSL_URL, {
    json: true,
    qs: {
      fromPlace: from,
      toPlace: to
    }
  });
  /*
  .then(function (response) {
    return xml2js.parseStringAsync(response);
  });
  */
}

module.exports.respond = function (event, callback) {
  getDigitransitRoutes(event.from, event.to)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
