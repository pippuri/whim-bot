'use strict';

const routing = require('./routing');

module.exports.respond = function (event, callback) {
  routing.getCombinedTripGoRoutes(event.from, event.to, event.leaveAt, event.arriveBy, event.format)
  .then(response => {
    callback(null, response);
  })
  .catch(err => {
    console.info('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });

};
