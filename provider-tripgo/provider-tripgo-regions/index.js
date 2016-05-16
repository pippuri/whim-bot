var request = require('request-promise-lite');

var TRIPGO_REGIONS_URL = 'https://tripgo.skedgo.com/satapp/regions.json';

// Get regions from TripGo
function getTripGoRegions() {
  return request.get(TRIPGO_REGIONS_URL, {
    json: true,
    headers: {
      'X-TripGo-Key': process.env.TRIPGO_API_KEY,
    },
  });
}

module.exports.respond = function (event, callback) {
  getTripGoRegions()
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
