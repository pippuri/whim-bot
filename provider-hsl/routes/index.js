var Promise = require('bluebird');
var request = require('request-promise');

var HSL_BASE_URL = 'http://api.reittiopas.fi/hsl/prod/';

function getHslRoutes(from, to) {
  return request.get(HSL_BASE_URL, {
    json: true,
    qs: {
      request: 'route',
      from: from,
      to: to,
      user: process.env.HSL_USERTOKEN,
      pass: process.env.HSL_PASSPHRASE
    }
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
