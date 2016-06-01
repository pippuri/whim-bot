const routing = require('../lib/routing');

const BASE_URL = 'https://hadron-fi-northfinland.tripgo.skedgo.com/satapp/routing.json';
const TAXI_PROVIDER = 'Valopilkku';

module.exports.respond = function (event, callback) {
  routing.getCombinedTripGoRoutes(BASE_URL, event.from, event.to, event.leaveAt, event.arriveBy, event.format, TAXI_PROVIDER)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
