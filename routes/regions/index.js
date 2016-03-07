var Promise = require('bluebird');
var request = require('request-promise');

// Get regions from TripGo
function getTripGoRegions() {
  return request.get('https://tripgo.skedgo.com/satapp/regions.json', {
    json: true,
    headers: {
      'X-TripGo-Key': process.env.TRIPGO_API_KEY
    }
  });
}

module.exports.respond = function (event, callback) {
  getTripGoRegions()
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
