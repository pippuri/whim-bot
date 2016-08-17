'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');

const ENDPOINT_URL = 'https://geocoder.api.here.com/6.2/search.json';

function parseResults(response) {
  const locations = [];
  const view = response.Response.View;

  if (!util.isArray(view)) {
    const error = new Error('Invalid response from HERE - invalid format.');
    return Promise.reject(error);
  }

  view.forEach(i => {
    const results = i.Result;

    results.forEach(result => {
      const item = result.Location;

      const location = {
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
  const query = {
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
  .then(locations => {
    return {
      locations: locations,
      query: query,
    };
  });
}

module.exports.respond = function (event, callback) {
  console.info(event);

  adapt(event)
  .then(response => {
    callback(null, response);
  })
  .catch(err => {
    console.info('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
