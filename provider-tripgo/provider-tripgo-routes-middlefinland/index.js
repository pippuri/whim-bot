var routing = require('../lib/routing');

var BASE_URL = 'https://hadron-fi-middlefinland.tripgo.skedgo.com/satapp/routing.json';

module.exports.respond = function (event, callback) {
  routing.getCombinedTripGoRoutes(BASE_URL, event.from, event.to, event.leaveAt, event.arriveBy, event.format)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
