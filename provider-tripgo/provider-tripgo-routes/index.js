'use strict';

const routing = require('./routing');

const TAXI_PROVIDER = 'Valopilkku';

module.exports.respond = function (event, callback) {

  routing.getCombinedTripGoRoutes(event.from, event.to, event.leaveAt, event.arriveBy, event.format, TAXI_PROVIDER)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });

};
