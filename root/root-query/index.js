'use strict';

const Promise = require('bluebird');

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
    callback(null, response);
  })
  .catch(err => {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
