var BBPromise = require('bluebird');
var fs = require('fs');
var path = require('path');
var swaggerJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'maas-api.json')));

// Respond with Swagger API JSON
function getApiJson() {
  return BBPromise.resolve(swaggerJson);
}

module.exports.respond = function (event, callback) {
  getApiJson()
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
