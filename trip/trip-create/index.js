'use strict';

const Trip = require('../../lib/trip');

module.exports.respond = function (event, callback) {

  return Trip.create(event)
    .then((response) => callback(null, response))
    .catch(err => {
      console.log(`This event caused error: ${JSON.stringify(event, null, 2)}`);
      callback(err);
    });
};
