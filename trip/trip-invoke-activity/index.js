'use strict';

const Promise = require('bluebird');
const Trip = require('../../lib/trip');

module.exports.respond = function (event, callback) {
  return Trip.runActivityTask(event)
    .then((response) => callback(null, response))
    .catch(err => {
      console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      callback(err);
    });
};

