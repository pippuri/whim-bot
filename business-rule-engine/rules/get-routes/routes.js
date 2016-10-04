'use strict';

const Promise = require('bluebird');
const getProviderRules = require('../get-provider');
const _getProviderBatch = getProviderRules.getProviderBatch;
const bus = require('../../../lib/service-bus');
const _ = require('lodash');
const polylineEncoder = require('polyline-extended');
const haversine = require('haversine');

const MAX_PARALLEL = 1; // how many common provider to use
// @NOTE support partially train route (go to Leppavaraa on train E)
const HSL_TRAINS  = ['I', 'K', 'N', 'T', 'A', 'E', 'L', 'P', 'U', 'X'];

/**
 * Calculate haversine length base on leg information
 * @param {object} leg
 * @return {float} haversine length
 */
function _haversineLength(leg) {
  if (!leg.hasOwnProperty('from')) return 0;

  if (!leg.hasOwnProperty('to')) return 0;

  const start = {
    latitude: leg.from.lat,
    longitude: leg.from.lon,
  };
  const end = {
    latitude: leg.to.lat,
    longitude: leg.to.lon,
  };
  const distance = haversine(start, end) * 1000;
  return Math.ceil(distance);
}

/**
 * Return only common providers for a leg that provide both From and To location
 * @param arriveBy {Float} Input arriveBy
 * @param leaveAt {Float} Input leaveAt
 * @param providersTo {Object}
 * @param providersFrom {Object}
 */
function _filterCommonLegProvider(arriveBy, leaveAt, providersFrom, providersTo) {
  const commonProvider = providersFrom
    // Filter out those that don't have the same agencyId
    .filter(providerFrom => {
      return typeof undefined !== typeof providersTo.find(providerTo => {
        return providerTo.agencyId === providerFrom.agencyId;
      });
    })
    // filter out those that don't support search options
    .filter(provider => {
      if (arriveBy && !provider.hasOwnProperty('providerMeta') && !provider.providerMeta.hasOwnProperty('capabilities') &&
      provider.providerMeta.capabilities.arriveBy === false) {
        return false;
      } else if (leaveAt && !provider.hasOwnProperty('providerMeta') && !provider.providerMeta.hasOwnProperty('capabilities') &&
      provider.providerMeta.capabilities.leaveAt === false) {
        return false;
      }
      return true;
    });
  if (commonProvider.length > MAX_PARALLEL) {
    commonProvider.splice(MAX_PARALLEL, commonProvider.length - MAX_PARALLEL);
  }

  return commonProvider;
}

/**
 * Check whether this request includes only car or taxi modes
 * @param modes {Array of String} mode to check
 * @return {Boolean}
 */
function _noPtWanted(modes) {
  if (modes) {
    return modes.split(',').every(mode => ['TAXI', 'CAR'].indexOf(mode) !== -1);
  }
  return false;
}

/**
 * Build provider query for public transit
 * @param modes {Array of String} modes to check
 * @param from {Object} contain lat and lon of 'from' provider
 * @return {Array} array of queries, contains query for provider of 'from' and 'to'
 */
function _buildPtRoutesProvidersQuery(modes, from, to) {
  if (_noPtWanted(modes)) return [];

    // Get provider for both from and to location
  return [
    {
      type: 'maas-routes-pt',
      location: { lat: from.lat, lon: from.lon },
    },
    {
      type: 'maas-routes-pt',
      location: { lat: to.lat, lon: to.lon },
    },
  ];
}

/**
 * Build provider query for Cars
 * @param from {Object} contain lat and lon of 'from' provider
 * @return {Array} array of queries, contains query for provider of 'from' and 'to'
 */
function _buildCarRoutesProvidersQuery(from, to) {
  return [
    {
      type: 'maas-routes-private',
      location: { lat: from.lat, lon: from.lon },
    },
    {
      type: 'maas-routes-private',
      location: { lat: to.lat, lon: to.lon },
    },
  ];
}


/**
 * Build provider query for public transit
 * @param modes {Array of String} modes to check
 * @param from {Object} contain lat and lon of 'from' provider
 * @return {Array} array of queries, contains query for provider of 'from' and 'to'
 */
function _buildMixedRoutesProvidersQuery(modes, from, to) {
  if (_noPtWanted(modes)) return [];
  return [
    {
      type: 'maas-routes-mixed',
      location: { lat: from.lat, lon: from.lon },
    },
    {
      type: 'maas-routes-mixed',
      location: { lat: to.lat, lon: to.lon },
    },
  ];
}

/**
 * Combine all routes provider query and run them though _getProviderBatch
 * @param params {Object} contains modes, from, to, leaveAt and arriveBy
 * @return common {Common provider}
 */
function _resolveRoutesProviders(params) {
  if (!params.from) throw new Error('Missing from input: ' + JSON.stringify(params, null, 2));
  if (!params.to) throw new Error('Missing to input: ' + JSON.stringify(params, null, 2));

  const location = {
    from: {
      lat: params.from.split(',')[0],
      lon: params.from.split(',')[1],
    },
    to: {
      lat: params.to.split(',')[0],
      lon: params.to.split(',')[1],
    },
  };

  return _getProviderBatch(
    {
      ptRoutes: _buildPtRoutesProvidersQuery(params.modes, location.from, location.to),
      carRoutes: _buildCarRoutesProvidersQuery(location.from, location.to),
      mixedRoutes: _buildMixedRoutesProvidersQuery(params.modes, location.from, location.to),
    }
  )
  .then(response => {
    let result = [];
    let common;
    let mixes;
    let cars;
    if (response.ptRoutes && response.ptRoutes.length > 0) {
      common = _filterCommonLegProvider(params.arriveBy, params.leaveAt, response.ptRoutes[0], response.ptRoutes[1]);
      if (common.length > 0) result = result.concat(common);
    }
    if (response.mixedRoutes && response.mixedRoutes.length > 0) {
      mixes = _filterCommonLegProvider(params.arriveBy, params.leaveAt, response.mixedRoutes[0], response.mixedRoutes[1]);
      if (mixes.length > 0) result = result.concat(mixes);
    }
    if (response.carRoutes.length > 0 && response.carRoutes.length >  0) {
      cars = _filterCommonLegProvider(params.arriveBy, params.leaveAt, response.carRoutes[0], response.carRoutes[1]);
      if (cars.length > 0) result = result.concat(cars);
    }
    if (result.length === 0) {
      return Promise.reject(new Error('Could not retrieve any routes provider'));
    }
    return Promise.resolve(result);
  });
}

/**
 * Merge all the responses received from providers invocation
 * @param responses {Array} input
 * @return {Object} merged output
 */
function _mergeProviderResponses(responses, params) {
  const coords = params.from.split(',').map(parseFloat);
  const output = {
    plan: {
      from: {
        lat: coords[0],
        lon: coords[1],
      },
      itineraries: [],
    },
  };

  responses.forEach(item => {
    output.plan.itineraries = output.plan.itineraries.concat(item.plan.itineraries);
  });
  return output;
}

/**
 * Call the lambda that adapter the provider response
 * @param providers {Array} contains many provider info, including its lambda adapter
 * @param params {Object} event input for the lambda
 * @return response {Promise - Array} response from provider invocation
 */
function _invokeProviders(providers, params) {
  if (providers && providers instanceof Array && providers.length === 0) return [];

  // Call multiple providers; If we got at least one succesful response, then return
  // all the succesful responses. If none found, reject with error.
  // (as long as one succeeds, we consider this a success).
  return Promise.all(providers.map(provider => bus.call(provider.providerName, params).reflect()))
    .filter(inspection => {
      if (!inspection.isFulfilled()) {
        const error = inspection.reason();
        console.warn(`Provider call failed: ${error.message}`);
        return false;
      }

      return true;
    })
    .map(inspection => inspection.value());
}

/**
 * Set agency for a leg, NOTE this is to adapt leg modes into carrier types
 * TODO Do not brute force, have a mapping data set on Provider table
 * @param leg {Object}
 * @return agencyId {String} agencyId of the leg
 */
function _setLegAgency(leg) {
  if (leg.mode && leg.agencyId) {
    return leg;
  }

  switch (leg.mode) {
    case 'CAR':
      leg.mode = 'TAXI';
      leg.agencyId = 'Valopilkku';
      break;
    case 'TAXI':
      leg.agencyId = 'Valopilkku';
      break;
    case 'TRAIN':
      // hook to see about VR and others
      if (!leg.agencyId && _.includes(HSL_TRAINS, leg.route)) {
        leg.agencyId = 'HSL';
      }
      break;
    case 'BUS':
      // NOTE cannot brute force all bus to HSL
      break;
    default:
      leg.agencyId = undefined;
      break;
  }

  return leg;
}

/**
 * Set agency for a leg in an itinerary, NOTE this is to adapt leg modes into carrier types
 * @param route {Object}
 * @return route {Object}
 */
function _setAgency(route) {
  if (!route.plan.itineraries) {
    throw new Error('Response from route adapter is malformed');
  }

  route.plan.itineraries.map(itinerary => itinerary.legs.map(_setLegAgency));
  return route;
}

function _calculateLegsDistance(route) {
  route.plan.itineraries.forEach(itinerary => {
    itinerary.legs.forEach(leg => {
      if (leg.legGeometry && leg.legGeometry.points) { // Default leg distance is so bad?
        const decodedPolyline = polylineEncoder.decode(leg.legGeometry.points);
        leg.distance = 0;
        for (let i = 0; i < decodedPolyline.length - 1; i++) {
          const line = {
            from: { lat: decodedPolyline[i][0], lon: decodedPolyline[i][1] },
            to: { lat: decodedPolyline[i + 1][0], lon: decodedPolyline[i + 1][1] },
          };
          leg.distance += _haversineLength(line);
        }
      }
    });
  });

  return route;
}

/**
 * Sotr the itienraries by a specification
 * @param route {Object} route to sort
 * @param sortBy {String} spec to sort according to
 * @return sorted route {Object} if sort routes if provided
 */
function _sortRoute(route, sortBy) {

  if (sortBy === 'distance') {
    route.plan.itineraries = route.plan.itineraries.sort((a, b) => {
      if (a.distance < b.distance) return -1;
      if (a.distance > b.distance) return 1;
      return 0;
    });
  } else if (sortBy === 'duration') {
    route.plan.itineraries = route.plan.itineraries.sort((a, b) => {
      if (a.duration < b.duration) return -1;
      if (a.duration > b.duration) return 1;
      return 0;
    });
  }

  return route;
}

/**
 * Get routes using from, to , leaveAt, arriveBy and modes
 * @param params {Object} contains from, to , leaveAt, arriveBy and modes
 */
function getRoutes(params) {
  return _resolveRoutesProviders(params)
    .then(providers => _invokeProviders(providers, params))
    .then(responses => _mergeProviderResponses(responses, params))
    .then(route => _setAgency(route))
    .then(route => _calculateLegsDistance(route))
    .then(route => _sortRoute(route, params.sortBy || 'distance')); // Sort by distance by default is no sortBy is input
}

module.exports = {
  getRoutes,
};
