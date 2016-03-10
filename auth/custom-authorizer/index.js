var Promise = require('bluebird');
var AWS = require('aws-sdk');

/**
 * This is the main custom authorizer that can be attached to any API.
 */
function customAuthorize(event) {
  return Promise.resolve({
  });
}

module.exports.respond = function (event, callback) {
  customAuthorize(event)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
