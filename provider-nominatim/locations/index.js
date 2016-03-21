var Promise = require('bluebird');
var request = require('request-promise');
var util = require('util');

var ENDPOINT_URL = 'http://nominatim.openstreetmap.org/search';

function adapt(input) {
  // Customise query by the hints given
  var query = {
      format: 'json',
      addressdetails: 1,
      limit: input.count,
      q: input.name,
  };

  switch(input.hint) {
    case 'latlon':
      // In absence of full circle, use bounding box. Use
      // http://stackoverflow.com/questions/1253499/simple-calculations-for-working-with-lat-lon-km-distance
      // Latitude: 1 deg = 110.574 km
      // Longitude: 1 deg = 111.320*cos(latitude) km
      // for conversion rule
      var latRadians = input.lat * Math.PI / 180;
      var lonRadians = input.lon * Math.PI / 180;
      var left = input.lon - input.radius / 111.320 * Math.cos(latRadians);
      var top = input.lat + input.radius / 110.574;
      var right = input.lon + input.radius / 111.320 * Math.cos(latRadians);
      var bottom = input.lat - input.radius / 110.574;

      query.viewbox = [ left, top, right, bottom ].join(',');
      // Force the boundaries
      //query.bounded = 1;
      break;
    case 'country':
      if (typeof input.city !== 'undefined') {
        query.q += ' ' + input.city;
      }
      query.q += ' ' + input.country;
      break;
    case 'none':
      break;
    default:
      throw new Error('Location hint not given');
  }

  return request.get(ENDPOINT_URL, {
    json: true,
    headers: {},
    qs: query
  })
  .then(parseResults)
  .then(function (locations) {
    return {
      locations: locations,
      query: query
    };
  });
}

function parseResults(response) {
  console.log(response);
  var locations = [];

  if (!util.isArray(response)) {
    var error = new Error('Invalid response from HERE - invalid format.');
    return Promise.reject(error);
  }

  response.forEach(function(item) {
    console.log(item);

    var location = {
      name: item.display_name,
      lat: item.lat,
      lon: item.lon,
      zipCode: item.address.postcode,
      city: item.address.city,
      country: item.address.country,
      address: item.address.construction
    };

    locations.push(location);
  });

  return Promise.resolve(locations);
}

module.exports.respond = function (event, callback) {
  adapt(event)
  .then(function(response) {
    callback(null, response);
  })
  .catch(function(err) {
    callback(err);
  });
};
