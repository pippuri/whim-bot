var Promise = require('bluebird');
var fs = require('fs');
var path = require('path');
var swaggerJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'maas-api.json')));

// Respond with Swagger API JSON
function getApiJson() {
  return Promise.resolve(swaggerJson);
}

module.exports.respond = function (event, callback) {
  getApiJson()
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    console.log('This event caused error: ' + event);
    callback(err);
  });
};
