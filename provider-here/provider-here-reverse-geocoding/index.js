'use strict';

/**
 * GeoJSON format compatible implementation of places, using HERE places API.
 * Sample:
 * {
 * "type": "Feature",
 * "geometry": {
 *   "type": "Point",
 *   "coordinates": [125.6, 10.1]
 * },
 * "properties": {
 *   "name": "Dinagat Islands"
 * }
 * }
 *
 * @see https://developer.here.com/rest-apis/documentation/places/topics_api/resource-search.html
 * @see https://developer.here.com/rest-apis/documentation/geocoder/topics/examples-reverse-geocoding.html
 * @see https://en.wikipedia.org/wiki/GeoJSON
 */
const Promise = require('bluebird');
const request = require('request-promise-lite');
const util = require('util');
const MaaSError = require('../../lib/errors/MaaSError');

const ENDPOINT_URL = 'https://reverse.geocoder.cit.api.here.com/6.2/reversegeocode.json';
const SEARCH_RADIUS = 500; // Find within 300m distance

function parseResults(response) {
  if (!response.Response || !util.isArray(response.Response.View) ||
    !response.Response.View[0] || !response.Response.View[0].Result ||
    !util.isArray(response.Response.View[0].Result)) {
    const message = `HERE returned an invalid result ${JSON.stringify(response, null, 2)}`;
    return Promise.reject(new MaaSError(message, 500));
  }

  // Only permit matches that have valid address (street & #)
  const filtered = response.Response.View[0].Result.filter(result => {
    // The MatchQuality values can be a numbers or arrays, but if they exist, it's sufficient
    return result.MatchQuality.HouseNumber && result.MatchQuality.Street;
  });

  const parsed = filtered.map(result => {
    const address = result.Location.Address;
    const coordinates = result.Location.DisplayPosition;

    const feature = {
      type: 'Feature',
      properties: {
        name: address.Label,
        country: address.Country,
        countryCode: address.Country,
        city: address.City,
        zipCode: address.PostalCode,
        streetName: address.Street,
        streetNumber: address.HouseNumber,
      },
      geometry: {
        type: 'Point',
        coordinates: [coordinates.Latitude, coordinates.Longitude],
      },
    };

    return feature;
  });

  return Promise.resolve(parsed);
}

function adapt(input) {
  const query = {
    mode: 'retrieveAddresses',
    app_id: process.env.HERE_APP_ID,
    app_code: process.env.HERE_APP_CODE,
    prox: `${input.lat},${input.lon},${SEARCH_RADIUS}`,
    language: input.lang,
    gen: 9,
  };

  return request.get(ENDPOINT_URL, {
    json: true,
    headers: {},
    qs: query,
  })
  .then(parseResults)
  .then(features => {
    // TODO Reformat to the new style responses
    return {
      type: 'FeatureCollection',
      features: features,
      query: query,
    };
  });
}

module.exports.respond = function (event, callback) {
  adapt(event)
  .then(response => {
    return callback(null, response);
  })
  .catch(err => {
    console.info('This event caused error: ' + JSON.stringify(event, null, 2));
    return callback(err);
  });
};
