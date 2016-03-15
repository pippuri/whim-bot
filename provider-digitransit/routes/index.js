var Promise = require('bluebird');
var request = require('request-promise');
var adapter = require('./adapter');

var DIGITRANSIT_HSL_URL = 'http://beta.digitransit.fi/otp/routers/hsl/plan';

function getDigitransitRoutes(from, to, format) {
  return request.get(DIGITRANSIT_HSL_URL, {
    json: true,
    qs: {
      fromPlace: from,
      toPlace: to
    }
  })
  .then(function (result) {
    if (format == 'original') {
      return result;
    } else {
      return adapter(result);
    }
  });
}

module.exports.respond = function (event, callback) {
  getDigitransitRoutes(event.from, event.to, event.format)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
