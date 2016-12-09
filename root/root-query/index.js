'use strict';

const MaaSError = require('../../lib/errors/MaaSError');

// Respond with a API version info at root
function getApiVersion() {
  return Promise.resolve({
    region: process.env.AWS_REGION,
    stage: process.env.SERVERLESS_STAGE,
    time: Date.now(),
  });
}

module.exports.respond = function (event, callback) {
  getApiVersion()
  .then(response => {
    console.info(response);

    callback(null, response);
  })
  .catch(_error => {
    console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    if (_error instanceof MaaSError) {
      callback(_error);
      return;
    }

    callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
  });
};
