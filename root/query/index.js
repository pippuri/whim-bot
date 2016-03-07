var Promise = require('bluebird');

// Respond with a API version info at root
function getApiVersion() {
  return Promise.resolve({
    region: process.env.AWS_REGION,
    stage: process.env.SERVERLESS_STAGE
  });
}

module.exports.respond = function (event, callback) {
  getApiVersion()
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
