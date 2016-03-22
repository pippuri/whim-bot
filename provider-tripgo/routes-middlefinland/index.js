var Promise = require('bluebird');
var routing = require('../lib/routing');

var BASE_URL = 'https://hadron-fi-middlefinland.tripgo.skedgo.com/satapp/routing.json';

module.exports.respond = function (event, callback) {
  routing.getCombinedTripGoRoutes(BASE_URL, event.from, event.to, event.format)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
