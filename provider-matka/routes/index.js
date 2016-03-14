var Promise = require('bluebird');
var request = require('request-promise');

var MATKA_BASE_URL = 'http://api.matka.fi/';

function getMatkaRoutes(from, to) {
  return request.get(MATKA_BASE_URL, {
    qs: {
      a: from,
      b: to,
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
