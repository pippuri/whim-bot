'use strict';

const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');

const ENDPOINT_URL = 'http://nominatim.openstreetmap.org/search';

function parseResults(response) {
  console.log(response);
  const locations = [];

  if (!util.isArray(response)) {
    const error = new Error('Invalid response from HERE - invalid format.');
    return Promise.reject(error);
  }

  response.forEach(function (item) {
    console.log(item);

    const location = {
      name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      zipCode: item.address.postcode,
      city: item.address.city,
      country: item.address.country,
      address: item.address.construction,
    };

    locations.push(location);
  });

  return Promise.resolve(locations);
}

function adapt(input) {

  // Customise query by the hints given
  const query = {
    format: 'json',
    addressdetails: 1,
    limit: input.count,
    q: input.name,
  };

  switch (input.hint) {
    case 'latlon': {

      // In absence of full circle, use bounding box. Use
      // http://stackoverflow.com/questions/1253499/simple-calculations-for-working-with-lat-lon-km-distance
      // Latitude: 1 deg = 110.574 km
      // Longitude: 1 deg = 111.320*cos(latitude) km
      // for conversion rule
      const latRadians = input.lat * Math.PI / 180;

      // const lonRadians = input.lon * Math.PI / 180; - not in use
      const left = input.lon - input.radius / 111.320 * Math.cos(latRadians);
      const top = input.lat + input.radius / 110.574;
      const right = input.lon + input.radius / 111.320 * Math.cos(latRadians);
      const bottom = input.lat - input.radius / 110.574;

      query.viewbox = [left, top, right, bottom].join(',');

      // Force the boundaries
      //query.bounded = 1;
      break;
    }

    case 'country': {
      if (typeof input.city !== 'undefined') {
        query.q += ' ' + input.city;
      }

      query.q += ' ' + input.country;
      break;
    }

    case 'none': {
      break;
    }

    default: {
      throw new Error('Location hint not given');
    }
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
  adapt(event)
  .then(function (response) {
    callback(null, response);
  })
  .catch(function (err) {
    console.log('This event caused error: ' + JSON.stringify(event, null, 2));
    callback(err);
  });
};
