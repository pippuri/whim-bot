'use strict';

const Promise = require('bluebird');
const Trip = require('../../lib/trip');

module.exports.respond = function (event, callback) {
  // maxBlockingTimeInSec should be same or less than lambda execution timeout
  // defined in s-function.json.
  return Trip.pollForDecisionTasks({ maxBlockingTimeInSec: 150 })
    .then(() => callback(null, null))
    .catch(err => {
      console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      callback(err);
    });
};
