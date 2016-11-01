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
const SEARCH_RADIUS = 500; // Find within 500m distance by default
//const SEARCH_COUNT = 10;   // Find a maximum of 10 results by default

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
  const radius = input.radius || SEARCH_RADIUS;
  // TODO Here does not support sorting by the quality of the data (e.g. whether we
  // have a street number), hence we cannot use minresult or maxresults nor use counts
  //const count = input.count || SEARCH_COUNT;
  const query = {
    mode: 'retrieveAddresses',
    app_id: process.env.HERE_APP_ID,
    app_code: process.env.HERE_APP_CODE,
    prox: `${input.lat},${input.lon},${radius}`,
    language: input.locale,
    // Prune away anything except for the address
    locationattributes: 'ar,-mr,-mv,-dt,-sd,-ad,-ai,-li,-in,-tz,-nb,-rn',
    // Prune away state, county, district, subdistrict, address line, add. data
    addressattributes: 'ctr,-sta,-cty,cit,-dis,-sdi,str,hnr,pst,-aln,-add',
    // Prune away performed search, match quality, match code, parsed request
    responseattributes: '-ps,mq,-mt,-mc,-pr',
    gen: 9,
    // Match at least city level information
    level: 'postalCode',
  };

  return request.get(ENDPOINT_URL, { json: true, qs: query })
  .then(parseResults)
  .then(features => {
    // TODO Reformat to the new style responses
    return {
      type: 'FeatureCollection',
      features: features,
      debug: query,
    };
  });
}

module.exports.respond = function (event, callback) {
  adapt(event)
  .then(response => (callback(null, response)))
  .catch(_error => {
    console.warn(`Caught an error: ${_error.message}, ${JSON.stringify(_error, null, 2)}`);
    console.warn('This event caused error: ' + JSON.stringify(event, null, 2));
    console.warn(_error.stack);

    // Uncaught, unexpected error
    if (_error instanceof MaaSError) {
      callback(_error);
      return;
    }

    callback(new MaaSError(`Internal server error: ${_error.toString()}`, 500));
  });
};
