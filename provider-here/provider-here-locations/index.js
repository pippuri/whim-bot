var Promise = require('bluebird');
var request = require('request-promise');
var util = require('util');

var ENDPOINT_URL = 'https://geocoder.api.here.com/6.2/search.json';

function parseResults(response) {
  var locations = [];
  var view = response.Response.View;

  if (!util.isArray(view)) {
    var error = new Error('Invalid response from HERE - invalid format.');
    return Promise.reject(error);
  }

  view.forEach(function (item) {
    var results = item.Result;

    results.forEach(function (result) {
      var item = result.Location;

      var location = {
        name: item.Address.Label,
        lat: result.Location.DisplayPosition.Latitude,
        lon: result.Location.DisplayPosition.Longitude,
        zipCode: item.Address.PostalCode,
        city: item.Address.City,
        country: item.Address.Country,
        address: item.Address.Street,
      };

      locations.push(location);
    });
  });

  return Promise.resolve(locations);
}

function adapt(input) {
  // Customise query by the hints given
  var query = {
    app_id: process.env.HERE_APP_ID,
    app_code: process.env.HERE_APP_CODE,
    searchtext: input.name,
    maxresults: input.count,
  };

  switch (input.hint) {
    case 'latlon':
      query.prox = [input.lat, input.lon, input.radius * 1000].join(',');
      break;
    case 'country':
      query.country = input.country;
      if (typeof input.city !== 'undefined') {
        query.city = input.city;
      }

      break;
    case 'none':
      break;
    default:
      throw new Error('Location hint not given');
  }

  return request.get(ENDPOINT_URL, {
    json: true,
    headers: {},
    qs: query,
  })
  .then(parseResults)
  .then(function (locations) {
    return {
      locations: locations,
      query: query,
    };
  });
}

module.exports.respond = function (event, callback) {
  console.log(event);

  adapt(event)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    callback(err);
  });
};
