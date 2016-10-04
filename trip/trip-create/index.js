'use strict';

const Trip = require('../../lib/trip');

module.exports.respond = function (event, callback) {

  return Trip.create(event)
    .then(response => callback(null, response))
    .catch(_error => {
      console.warn(`Caught an error:  ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
      console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
      console.warn(_error.stack);

      callback(_error);
    });
};
